$env:ANTHROPIC_BASE_URL="http://localhost:11434"
$env:ANTHROPIC_AUTH_TOKEN="ollama"
Remove-Item Env:ANTHROPIC_API_KEY -ErrorAction SilentlyContinue

claude --model qwen2.5-coder:3b