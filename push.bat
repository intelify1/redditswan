@echo off
REM Push the latest RedditSwan code to GitHub. Double-click or run: push
cd /d "%~dp0"
git add -A
git commit -m "update from build session"
git pull --rebase origin main
git push -u origin main
echo.
echo Done. Check https://github.com/intelify1/redditswan
pause
