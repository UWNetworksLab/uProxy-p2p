@echo off

:: Get the directory where this script is and set ROOT_DIR to that path. This
:: allows script to be run from different directories but always act on the
:: directory of the project (which is where this script is located).
for %%F in (%0) do set ROOT_DIR=%%~dpF
set NPM_BIN_DIR=%ROOT_DIR%node_modules\.bin\
cd "%ROOT_DIR%"

if "%1" == "install" (
	call :installDevDependencies
	exit /b 0
)
if "%1" == "tools" (
	call :installTools
	exit /b 0
)
if "%1" == "third_party" (
	call :installThirdParty
	exit /b 0
)
if "%1" == "clean" (
	call :clean
	exit /b 0
)
if "%1" NEQ "install" if "%1" NEQ "tools" ^
if "%1" NEQ "third_party" if "%1" NEQ "clean" (
	echo Usage: setup.sh [install^|tools^|third_party^|clean]
	echo   install       Installs 'node_modules' and 'build/third_party'
	echo   tools         Installs build tools into 'build/tools'
	echo   third_party   Installs 'build/third_party'
	echo   clean         Removes all dependencies installed by this script.
	exit /b 0
)

:: runCmd will run built-in DOS commands, and ignore errors
:runCmd
	echo Running: %1
	%~1
goto:eof

:: On Windows, npm, bower, tsd, and grunt are batch files,
:: so we have to explicitly call them with "call"
:: These also happen to be the commands that we want to assert, 
:: or exit on failure for, so there is an additional "exit /b"
:runAndAssertCmd
	echo Running: %1
	call %~1 || exit /b
goto:eof

:: Same as runAndAssertCmd, but takes in an arbitrary number of
:: arguments, and calls them without stripping the double quotes
:: This is used for commands where the path may have spaces
:runAndAssertCmdArgs
	echo Running: %*
	call %* || exit /b
goto:eof

:: We use robocopy to delete these folders since they (esp. node_modules)
:: may have path lengths greater than 260 characters
:clean
	call :runCmd "mkdir empty_dir"
	call :runCmd "robocopy empty_dir node_modules /mir > nul 2>&1"
	call :runCmd "robocopy empty_dir build /mir > nul 2>&1"
	call :runCmd "robocopy empty_dir .tscache /mir > nul 2>&1"
	call :runCmd "rmdir empty_dir node_modules build .tscache /s /q"
goto:eof

:installTools
	call :runCmd "mkdir build\tools"
	call :runCmd "copy node_modules\uproxy-lib\build\tools\* build\tools\"
goto:eof

:installThirdParty
	call :runAndAssertCmdArgs "%NPM_BIN_DIR%bower" install --allow-root
	call :runAndAssertCmdArgs "%NPM_BIN_DIR%tsd" reinstall --config .\third_party\tsd.json
	call :runAndAssertCmdArgs "%NPM_BIN_DIR%grunt" copy:thirdParty
goto:eof

:installDevDependencies
	call :runAndAssertCmd "npm install"
	call :installTools
	call :installThirdParty
goto:eof