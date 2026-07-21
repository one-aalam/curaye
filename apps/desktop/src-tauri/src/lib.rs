mod commands;

use commands::{
    create_document, link_project, parse_raw, pick_directory, read_document, read_registry,
    reveal_in_finder, scan_project, serialize_document, sync_project, unlink_project,
    write_document, write_registry,
};

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            pick_directory,
            read_registry,
            write_registry,
            link_project,
            unlink_project,
            scan_project,
            read_document,
            write_document,
            parse_raw,
            serialize_document,
            create_document,
            reveal_in_finder,
            sync_project,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
