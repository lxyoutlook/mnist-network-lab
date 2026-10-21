@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
set PYTHONUTF8=1
if exist ".venv\Scripts\python.exe" (
    ".venv\Scripts\python.exe" -X utf8 bootstrap.py %*
    goto done
)
where py >nul 2>nul
if not errorlevel 1 (
    for %%V in (3.12 3.13 3.14) do (
        py -%%V -c "import struct; assert struct.calcsize('P') == 8" >nul 2>nul
        if not errorlevel 1 (
            py -%%V -X utf8 bootstrap.py %*
            goto done
        )
    )
)
where python >nul 2>nul
if errorlevel 1 (
    echo 请先安装 64 位 Python 3.12，并勾选 Add python.exe to PATH，再双击此文件。
    pause
    exit /b 1
)
python -X utf8 bootstrap.py %*
:done
set "DEMO_EXIT_CODE=%errorlevel%"
if not "%DEMO_EXIT_CODE%"=="0" pause
exit /b %DEMO_EXIT_CODE%
