mod commands;

use commands::{
    cancel_ai_stream, create_document, get_ai_config, link_project, parse_raw, pick_directory,
    read_document, read_registry, reveal_in_finder, scan_project, serialize_document,
    start_ai_stream, sync_project, unlink_project, write_ai_config, write_document, write_registry,
    AiStreamState,
};

pub fn run() {
    tauri::Builder::default()
        .manage(AiStreamState(std::sync::Arc::new(std::sync::Mutex::new(None))))
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
            get_ai_config,
            write_ai_config,
            start_ai_stream,
            cancel_ai_stream,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
