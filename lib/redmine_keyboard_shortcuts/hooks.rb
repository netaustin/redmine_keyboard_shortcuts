class RedmineKeyboardShortcutsHooks < Redmine::Hook::ViewListener
  render_on :view_layouts_base_html_head, :partial => 'ks_manager/init_keyboard_shortcuts', :layout => false
end