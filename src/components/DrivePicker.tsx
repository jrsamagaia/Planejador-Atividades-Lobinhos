import React, { useState, useEffect } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import firebaseConfig from '../../firebase-applet-config.json';

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

const CLIENT_ID = (firebaseConfig as any).oAuthClientId || '';
const API_KEY = firebaseConfig.apiKey || '';
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata.readonly';

interface DrivePickerProps {
  onFilePicked: (file: { name: string; url: string }) => void;
  disabled?: boolean;
}

export const DrivePicker: React.FC<DrivePickerProps> = ({ onFilePicked, disabled }) => {
  const [pickerApiLoaded, setPickerApiLoaded] = useState(false);
  const [tokenClient, setTokenClient] = useState<any>(null);
  const [isPicking, setIsPicking] = useState(false);

  useEffect(() => {
    // Load the Picker API
    if (window.gapi) {
      window.gapi.load('picker', () => {
        setPickerApiLoaded(true);
      });
    }

    // Initialize Token Client
    if (window.google && window.google.accounts && window.google.accounts.oauth2) {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (response: any) => {
          if (response.error !== undefined) {
            console.error(response);
            setIsPicking(false);
            return;
          }
          createPicker(response.access_token);
        },
      });
      setTokenClient(client);
    }
  }, []);

  const createPicker = (accessToken: string) => {
    if (!window.google || !window.google.picker) {
      setIsPicking(false);
      return;
    }

    const view = new window.google.picker.DocsView();
    view.setIncludeFolders(true);

    const picker = new window.google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(accessToken)
      .setDeveloperKey(API_KEY)
      .setCallback(pickerCallback)
      .build();
    
    picker.setVisible(true);
  };

  const pickerCallback = (data: any) => {
    if (data.action === window.google.picker.Action.PICKED) {
      const doc = data.docs[0];
      onFilePicked({
        name: doc.name,
        url: doc.url,
      });
      setIsPicking(false);
    } else if (data.action === window.google.picker.Action.CANCEL) {
      setIsPicking(false);
    }
  };

  const handleAuthClick = () => {
    if (!tokenClient || !pickerApiLoaded) {
      alert("As bibliotecas do Google Drive ainda estão carregando. Tente novamente em alguns segundos.");
      return;
    }
    setIsPicking(true);
    // This will trigger the popup and then the callback we defined above
    tokenClient.requestAccessToken({ prompt: '' });
  };

  return (
    <div className="flex flex-col space-y-4">
      <h4 className="text-sm font-semibold text-neutral-700">Adicionar Arquivos</h4>
      <div className="group relative">
        <div className="flex items-center justify-center w-full">
          <button
            type="button"
            disabled={disabled || isPicking || !pickerApiLoaded}
            onClick={handleAuthClick}
            className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-[#013B88]/30 rounded-lg cursor-pointer bg-blue-50/50 hover:bg-blue-50 transition-colors disabled:opacity-50"
          >
            <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
              {isPicking ? (
                <Loader2 className="w-8 h-8 mb-2 text-[#013B88] animate-spin" />
              ) : (
                <Upload className="w-8 h-8 mb-2 text-[#013B88]" />
              )}
              <p className="mb-1 text-xs text-neutral-600">
                <span className="font-semibold text-[#013B88]">Selecionar do Google Drive</span>
              </p>
              <p className="text-[10px] text-neutral-500">
                Os arquivos serão adicionados à biblioteca para referência
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
