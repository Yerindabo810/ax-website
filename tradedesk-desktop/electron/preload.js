const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopAPI', {
  platform: process.platform,
  printReceipt: (receiptData) => ipcRenderer.invoke('print-receipt', receiptData),
});

