Redmine::Plugin.register :redmine_keyboard_shortcuts do
  name 'Redmine Keyboard Shortcuts'
  author 'Austin Smith'
  description 'Add vim-style keyboard shortcuts to Redmine'
  version '0.0.1'
  url 'https://github.com/netaustin/redmine_keyboard_shortcuts'
  author_url 'http://www.alleyinteractive.com/'
end

require 'redmine_keyboard_shortcuts/hooks.rb'