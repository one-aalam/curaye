mod commands;

use tauri::Manager;
use commands::{
    assign_spec_to_release, cancel_ai_stream, create_document, create_release, generate_brief_context,
    get_ai_config, get_last_opened, link_project, parse_raw, pick_directory, read_document,
    read_registry, reveal_in_finder, save_brief, scan_backlog, scan_project, scan_release_specs,
    scan_releases, serialize_document, set_last_opened, ship_release, start_ai_stream, sync_project,
    unlink_project, update_release_status, update_spec_status, write_ai_config, write_document,
    write_registry, AiStreamState,
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
            scan_backlog,
            update_spec_status,
            scan_releases,
            scan_release_specs,
            create_release,
            assign_spec_to_release,
            update_release_status,
            ship_release,
            get_ai_config,
            write_ai_config,
            start_ai_stream,
            cancel_ai_stream,
            generate_brief_context,
            save_brief,
            get_last_opened,
            set_last_opened,
        ])
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();

            #[cfg(target_os = "macos")]
            {
                use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};
                apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, Some(12.0))
                    .expect("failed to apply vibrancy");
            }

            #[cfg(target_os = "windows")]
            {
                use window_vibrancy::apply_mica;
                apply_mica(&window, Some(true)).expect("failed to apply mica");
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
