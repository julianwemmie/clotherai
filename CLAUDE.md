# Instructions for Claude

## Before Starting Work

**ALWAYS read these files first before beginning any work:**

1. **[README.md](README.md)** - Review the project README

## Testing Resources

- **Test image for upload testing**: `data/test-outfit.jpg` - Use this image for testing upload functionality.

## Environment Configuration

- **UV Package Manager**: The `uv` command is located at `/Users/julia/.local/bin/uv`. Always use the full path when running uv commands since `.local/bin` is not in the non-interactive shell PATH.
- **Check running processes first**: Before starting frontend or backend, verify they aren't already running. Only start them if needed. Create a simple file to keep track of this: did_claude_start_app.json, with true or false.

## After Completing Work

 - Verify frontend styling with Playwright MCP
 - After done using Playwright MCP, delete any screenshots in .playwright-mcp folder
 - **Kill all running processes**: Check did_claude_start_app.json to see if Claude started the frontend and backend. If Claude started them i.e. the file is true, then check for and terminate any leftover frontend (vite, esbuild) and backend (python, uvicorn) processes to prevent port conflicts and resource usage

   **Required cleanup commands:**
   ```bash
   # Kill processes by name
   pkill -f "uvicorn" 2>/dev/null
   pkill -f "vite" 2>/dev/null
   pkill -f "esbuild" 2>/dev/null

   # Verify ports are free
   lsof -i :5173 2>/dev/null || echo "Port 5173 is free"
   lsof -i :8000 2>/dev/null || echo "Port 8000 is free"

   # If ports still in use, kill by PID shown in lsof output
   # kill -9 <PID>
   ```
- Final cleanup is to delete did_claude_start_app.json tmp file.
