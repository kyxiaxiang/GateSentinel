@echo off
echo Building Beacon v1.0.0...
echo.

REM 检查编译器是否可用
where cl >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: Visual Studio compiler not found. Please run this from a Visual Studio Developer Command Prompt.
    pause
    exit /b 1
)

REM 创建输出目录
if not exist "build" mkdir build

REM 检查编译模式参数
if "%1"=="dll" (
    goto build_dll
) else if "%1"=="exe" (
    goto build_exe
) else (
    echo Usage: build.bat [dll^|exe]
    echo.
    echo dll - Build as DLL library
    echo exe - Build as EXE executable
    echo.
    echo If no parameter is specified, both versions will be built.
    echo.
    
    if "%1"=="" (
        echo Building both versions...
        echo.
        call :build_exe
        call :build_dll
        goto end
    ) else (
        echo Invalid parameter: %1
        pause
        exit /b 1
    )
)

:build_exe
echo Compiling Beacon as EXE...
cl /O2 /GL /W3 /nologo /Fe:build\beacon.exe ^
   beacon.c http.c tasks.c utils.c ^
   wininet.lib psapi.lib kernel32.lib user32.lib advapi32.lib

if %errorlevel% neq 0 (
    echo EXE build failed!
    if "%1"=="" pause
    exit /b 1
)

echo EXE build completed successfully!
echo Output: build\beacon.exe
echo.
goto :eof

:build_dll
echo Compiling Beacon as DLL...
cl /O2 /GL /W3 /nologo /LD /Fe:build\beacon.dll ^
   /DBUILD_DLL ^
   beacon.c http.c tasks.c utils.c ^
   /DEF:beacon.def ^
   wininet.lib psapi.lib kernel32.lib user32.lib advapi32.lib

if %errorlevel% neq 0 (
    echo DLL build failed!
    if "%1"=="" pause
    exit /b 1
)

echo DLL build completed successfully!
echo Output: build\beacon.dll
echo Import library: build\beacon.lib
echo.
goto :eof

:end
echo All builds completed successfully!
echo.
echo EXE Output: build\beacon.exe
echo DLL Output: build\beacon.dll
echo DLL Import library: build\beacon.lib
echo.

REM 清理临时文件
del *.obj 2>nul
del *.exp 2>nul

echo Press any key to exit...
pause >nul 