require 'redmine'

Redmine::Plugin.register :redmine_keyboard_shortcuts do
  name 'Redmine Keyboard Shortcuts'
  author 'Austin Smith'
  description 'Add vim-style keyboard shortcuts to Redmine'
  version '0.0.1'
  url 'http://example.com/path/to/plugin'
  author_url 'http://www.alleyinteractive.com/'
end

require 'redmine_keyboard_shortcuts/hooks.rb'