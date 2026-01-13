# Instructions for Claude

## Before Starting Work

**ALWAYS read these files first before beginning any work:**

1. **[plan.md](plan.md)** - Review the overall project plan and current stage requirements
2. **[PROGRESS.md](PROGRESS.md)** - Check what's been completed and what's in progress

## Testing Resources

- **Test image for upload testing**: `data/test-outfit.jpg` - Use this image for testing upload functionality.

## Environment Configuration

- **UV Package Manager**: The `uv` command is located at `/Users/julia/.local/bin/uv`. Always use the full path when running uv commands since `.local/bin` is not in the non-interactive shell PATH.

## After Completing Work

 - Verify frontend styling with Playwright MCP
 - After done using Playwright MCP, delete any screenshots in .playwright-mcp folder
 - **Kill all running processes**: Check for and terminate any leftover frontend (vite, esbuild) and backend (python, uvicorn) processes to prevent port conflicts and resource usage

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