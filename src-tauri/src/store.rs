use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

const DATA_FILE: &str = "data.json";

fn data_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("could not resolve the app data directory: {e}"))?;
    Ok(dir.join(DATA_FILE))
}

/// Reads the file, treating "not found" as "nothing stored yet" but surfacing every
/// other error. The frontend refuses to start on a load failure, which is what keeps
/// a bad read from overwriting good data.
fn read_optional(path: &Path) -> Result<Option<String>, String> {
    match fs::read_to_string(path) {
        Ok(contents) => Ok(Some(contents)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("could not read {}: {e}", path.display())),
    }
}

/// Writes to a sibling temp file, flushes it to disk, then renames over the real one.
/// A crash mid-write therefore leaves the previous file intact instead of a half-written
/// one. `fs::rename` replaces the destination on both Unix and Windows.
fn write_atomic(path: &Path, contents: &str) -> Result<(), String> {
    let dir = path
        .parent()
        .ok_or_else(|| format!("{} has no parent directory", path.display()))?;
    fs::create_dir_all(dir).map_err(|e| format!("could not create {}: {e}", dir.display()))?;

    let tmp = path.with_extension("json.tmp");
    {
        let mut file =
            fs::File::create(&tmp).map_err(|e| format!("could not open {}: {e}", tmp.display()))?;
        file.write_all(contents.as_bytes())
            .map_err(|e| format!("could not write {}: {e}", tmp.display()))?;
        file.sync_all()
            .map_err(|e| format!("could not flush {}: {e}", tmp.display()))?;
    }
    fs::rename(&tmp, path).map_err(|e| format!("could not replace {}: {e}", path.display()))?;
    Ok(())
}

/// Returns the stored envelope as JSON text, or `None` when no data file exists yet.
#[tauri::command]
pub fn load_data(app: AppHandle) -> Result<Option<String>, String> {
    read_optional(&data_path(&app)?)
}

#[tauri::command]
pub fn save_data(app: AppHandle, contents: String) -> Result<(), String> {
    write_atomic(&data_path(&app)?, &contents)
}

/// Where the data file lives, for display in the UI.
#[tauri::command]
pub fn data_file_path(app: AppHandle) -> Result<String, String> {
    Ok(data_path(&app)?.display().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    /// A unique scratch directory per test, removed on drop.
    struct TempDir(PathBuf);

    impl TempDir {
        fn new(tag: &str) -> Self {
            let nanos = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos();
            let dir = std::env::temp_dir().join(format!("lmm-{tag}-{nanos}"));
            fs::create_dir_all(&dir).unwrap();
            TempDir(dir)
        }

        fn path(&self, name: &str) -> PathBuf {
            self.0.join(name)
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn read_optional_returns_none_when_missing() {
        let dir = TempDir::new("missing");
        assert_eq!(read_optional(&dir.path("data.json")).unwrap(), None);
    }

    #[test]
    fn write_then_read_round_trips() {
        let dir = TempDir::new("roundtrip");
        let path = dir.path("data.json");

        write_atomic(&path, r#"{"version":1}"#).unwrap();

        assert_eq!(
            read_optional(&path).unwrap(),
            Some(r#"{"version":1}"#.to_string())
        );
    }

    #[test]
    fn write_replaces_an_existing_file() {
        let dir = TempDir::new("replace");
        let path = dir.path("data.json");

        write_atomic(&path, "first").unwrap();
        write_atomic(&path, "second").unwrap();

        assert_eq!(read_optional(&path).unwrap(), Some("second".to_string()));
    }

    #[test]
    fn write_creates_missing_parent_directories() {
        let dir = TempDir::new("nested");
        let path = dir.path("nested/deeper/data.json");

        write_atomic(&path, "made it").unwrap();

        assert_eq!(read_optional(&path).unwrap(), Some("made it".to_string()));
    }

    #[test]
    fn write_leaves_no_temp_file_behind() {
        let dir = TempDir::new("tmp");
        let path = dir.path("data.json");

        write_atomic(&path, "done").unwrap();

        assert!(!dir.path("data.json.tmp").exists());
    }

    #[test]
    fn read_surfaces_errors_other_than_missing() {
        let dir = TempDir::new("isdir");
        // A directory where the data file should be: not "missing", so it must error
        // rather than report an empty store.
        let path = dir.path("data.json");
        fs::create_dir_all(&path).unwrap();

        assert!(read_optional(&path).is_err());
    }
}
