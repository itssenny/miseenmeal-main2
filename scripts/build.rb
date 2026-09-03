require 'fileutils'
require 'json'

FileUtils.rm_rf('dist')
FileUtils.mkdir_p('dist/db')
FileUtils.mkdir_p('dist/server')
FileUtils.mkdir_p('dist/.openai')
%w[index.html styles.css app.js auth.js profile.js supabase-client.js supabase-config.example.js ARCHITECTURE.md].each{|f|FileUtils.cp(f,"dist/#{f}")}

supabase_url = ENV['SUPABASE_URL']
supabase_publishable_key = ENV['SUPABASE_PUBLISHABLE_KEY']

if supabase_url && supabase_publishable_key
  File.write('dist/supabase-config.local.js', <<~JS)
    window.__SUPABASE_CONFIG__ = {
      url: #{JSON.generate(supabase_url)},
      publishableKey: #{JSON.generate(supabase_publishable_key)}
    };
  JS
elsif File.exist?('supabase-config.local.js')
  FileUtils.cp('supabase-config.local.js', 'dist/supabase-config.local.js')
end

FileUtils.cp('db/schema.sql','dist/db/schema.sql')
FileUtils.cp_r('db/supabase','dist/db/supabase')
FileUtils.cp('.openai/hosting.json','dist/.openai/hosting.json')
File.write('dist/server/index.js', <<~JS)
  export default { async fetch(request, env) { return env.ASSETS.fetch(request); } };
JS
puts 'Built dist/'
