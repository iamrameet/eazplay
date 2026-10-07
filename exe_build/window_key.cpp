#include <Windows.h>

// Keyboard hook procedure
LRESULT CALLBACK KeyboardProc(int nCode, WPARAM wParam, LPARAM lParam) {
  if (nCode == HC_ACTION) {
    KBDLLHOOKSTRUCT *kbStruct = (KBDLLHOOKSTRUCT *) lParam;

    // Check if the Windows key is pressed
    if (kbStruct->vkCode == VK_LWIN || kbStruct->vkCode == VK_RWIN) {
      return 1; // Suppress the Windows key press
    }
    if (kbStruct->vkCode == VK_TAB && GetAsyncKeyState(VK_MENU) < 0)
    {
      return 1; // Suppress the Windows key press
    }
  }

  return CallNextHookEx(NULL, nCode, wParam, lParam);
}

int main()
{
  // Set a keyboard hook to intercept key events
  HHOOK hook = SetWindowsHookEx(WH_KEYBOARD_LL, KeyboardProc, GetModuleHandle(NULL), 0);

  if (hook == NULL)
  {
    // Hook setup failed
    return 1;
  }

  // Keep the application running
  MSG msg;
  while (GetMessage(&msg, NULL, 0, 0) != 0)
  {
    TranslateMessage(&msg);
    DispatchMessage(&msg);
  }

  // Release the hook
  UnhookWindowsHookEx(hook);

  return 0;
}
