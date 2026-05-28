react
import React, { useState, useEffect, useRef } from 'react';
import { UploadCloud, Download, Video, CheckCircle, Clock, PlaySquare, AlertCircle, Image as ImageIcon, FileText, X, Folder, Info, ExternalLink } from 'lucide-react';

// --- IMPORTS FIREBASE OFFICIELS ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';

// --- TA CONFIGURATION FIREBASE (Ne pas modifier) ---
const firebaseConfig = {
  apiKey: "AIzaSyC-c3lsOdCM--I0wlZBuN2fNeH_2DqxGdY",
  authDomain: "gorillat-shart.firebaseapp.com",
  projectId: "gorillat-shart",
  storageBucket: "gorillat-shart.firebasestorage.app",
  messagingSenderId: "98642718505",
  appId: "1:98642718505:web:d5d0b5ac7715f3c89ed138",
  measurementId: "G-X9DNLZXKSK"
};

// Initialisation de TES services Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
// On utilise ton nom de projet comme identifiant de collection
const collectionName = 'gorillat_share_videos';

export default function App() {
  const [user, setUser] = useState(null);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [notification, setNotification] = useState({ show: false, message: '', type: 'error' });

  // États du formulaire
  const [uploaderName, setUploaderName] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [videoType, setVideoType] = useState('brute'); // 'brute' ou 'montee'
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [thumbnailData, setThumbnailData] = useState(null);
  
  // États de l'upload
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  
  // État du modal de téléchargement (Nouveau)
  const [selectedVideoForDownload, setSelectedVideoForDownload] = useState(null);

  const fileInputRef = useRef(null);

  // 1. Authentification Anonyme (Invisible pour l'utilisateur, mais obligatoire pour Firebase)
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Erreur d'authentification Firebase:", err);
        showNotification("Erreur de connexion à ta base de données Firebase. Vérifie les règles Firestore !", "error");
      }
    };
    
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. Récupération des vidéos depuis TA base de données
  useEffect(() => {
    if (!user) return;
    
    // On écoute la collection à la racine de ta base de données
    const videosRef = collection(db, collectionName);
    
    const unsubscribe = onSnapshot(videosRef, (snapshot) => {
      const vids = [];
      snapshot.forEach((doc) => {
        vids.push({ id: doc.id, ...doc.data() });
      });
      // Tri par date de création (les plus récentes en premier)
      vids.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setVideos(vids);
      setLoading(false);
    }, (err) => {
      console.error("Erreur Firestore:", err);
      showNotification("Impossible de charger les vidéos. As-tu bien mis les règles Firestore sur 'true' ?", "error");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const showNotification = (message, type = 'error') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: 'error' }), 6000);
  };

  // --- GESTION DES FICHIERS ---
  const processFiles = (filesArray) => {
    if (selectedFiles.length + filesArray.length > 40) {
      showNotification("⚠️ Limite atteinte : Tu ne peux pas envoyer plus de 40 vidéos à la fois.", "error");
      const allowedFiles = filesArray.slice(0, 40 - selectedFiles.length);
      setSelectedFiles(prev => [...prev, ...allowedFiles]);
      return;
    }
    setSelectedFiles(prev => [...prev, ...filesArray]);
  };

  const handleFileSelection = (e) => {
    if (e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
      e.target.value = ''; 
    }
  };

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('video/'));
    processFiles(droppedFiles);
  };
  const removeFile = (indexToRemove) => setSelectedFiles(prev => prev.filter((_, index) => index !== indexToRemove));

  // --- MINIATURE ---
  const handleThumbnailChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const MAX_WIDTH = 500;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setThumbnailData(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  // --- UPLOAD VIA API GOFILE ---
  const uploadToGofile = (file, server) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      // Nouvel endpoint de l'API Gofile (l'ancien ne marche plus)
      xhr.open('POST', `https://${server}.gofile.io/contents/uploadfile`);
      
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setUploadProgress((e.loaded / e.total) * 100);
        }
      };
      
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const res = JSON.parse(xhr.responseText);
            if (res.status === 'ok') {
              resolve(res.data);
            } else {
              reject(new Error("L'API Gofile a refusé l'envoi (" + res.status + ")"));
            }
          } catch(e) { reject(e); }
        } else {
          reject(new Error("Erreur serveur Gofile (Code: " + xhr.status + ")"));
        }
      };
      
      xhr.onerror = () => reject(new Error("Erreur réseau. Désactive ton bloqueur de pub."));
      
      const formData = new FormData();
      formData.append('file', file);
      // On a supprimé le folderId qui bloquait les envois anonymes
      xhr.send(formData);
    });
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploaderName || !videoTitle || selectedFiles.length === 0) {
      showNotification("Veuillez remplir le nom, le titre et ajouter au moins une vidéo.", "error");
      return;
    }
    if (!user) {
       showNotification("Erreur: Non connecté à Firebase. Recharge la page.", "error");
       return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      setUploadStatus("Recherche d'un serveur d'hébergement...");
      const serverRes = await fetch('https://api.gofile.io/servers');
      const serverData = await serverRes.json();
      
      if (serverData.status !== 'ok') throw new Error("Serveurs indisponibles.");
      const serverName = serverData.data.servers[0].name;

      const uploadedFiles = [];

      // Envoi des fichiers
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        setUploadStatus(`Envoi vidéo ${i + 1}/${selectedFiles.length}... Ne quitte pas la page !`);
        setUploadProgress(0); 
        
        const data = await uploadToGofile(file, serverName);
        
        // On sauvegarde le nom et le lien unique de chaque fichier
        uploadedFiles.push({
          name: file.name,
          link: data.downloadPage
        });
      }

      setUploadStatus("Sauvegarde dans ta base de données Firebase...");
      setUploadProgress(100);

      // 3. Sauvegarde dans TA base de données
      const videosRef = collection(db, collectionName);
      await addDoc(videosRef, {
        title: videoTitle,
        uploader: uploaderName,
        type: videoType,
        files: uploadedFiles, // On sauvegarde directement le tableau
        thumbnailData: videoType === 'montee' ? thumbnailData : null,
        createdAt: serverTimestamp(),
      });

      // Nettoyage
      setVideoTitle('');
      setSelectedFiles([]);
      setThumbnailData(null);
      setIsUploading(false);
      showNotification("Vidéos envoyées avec succès !", "success");
      
    } catch (err) {
      console.error("Erreur complète:", err);
      showNotification(`L'envoi a échoué: ${err.message}`, "error");
      setIsUploading(false);
    }
  };

  const videosBrutes = videos.filter(v => v.type === 'brute');
  const videosMontees = videos.filter(v => v.type === 'montee');

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans selection:bg-green-500 selection:text-white pb-12">
      
      {/* NOTIFICATIONS */}
      {notification.show && (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-full flex items-center shadow-2xl transition-all w-11/12 max-w-md ${notification.type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}>
          {notification.type === 'error' ? <AlertCircle className="w-6 h-6 mr-3 shrink-0" /> : <CheckCircle className="w-6 h-6 mr-3 shrink-0" />}
          <span className="font-medium text-sm leading-tight">{notification.message}</span>
        </div>
      )}

      {/* HEADER */}
      <header className="bg-gradient-to-r from-green-900 to-neutral-900 border-b border-green-800/50 shadow-lg shadow-green-900/20 py-4 px-4 md:px-8 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-3">
          <div className="bg-green-500 p-2 rounded-xl shadow-[0_0_15px_rgba(34,197,94,0.5)]">
            <PlaySquare className="w-8 h-8 text-black" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white uppercase">Gorillat <span className="text-green-500">Share</span></h1>
            <p className="text-xs text-green-300 font-medium tracking-wider">Connecté à Firebase</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-8 space-y-10">
        
        {/* ASTUCE MOBILE */}
        <div className="bg-blue-500/10 border border-blue-500/30 text-blue-400 p-4 rounded-2xl text-sm flex items-start">
          <Info className="w-6 h-6 mr-3 shrink-0 mt-0.5" />
          <div>
            <strong className="block text-base mb-1">📱 Astuce de sélection :</strong>
            Sur Android/iPhone, <b>reste appuyé longtemps</b> sur la première vidéo dans ta galerie, puis coche les autres. Le site créera <b>un seul lien</b> pour toutes les télécharger d'un coup !
          </div>
        </div>

        {/* FORMULAIRE */}
        <section className="bg-neutral-900 rounded-3xl border border-neutral-800 p-6 md:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
          
          <h2 className="text-xl md:text-2xl font-bold mb-6 flex items-center">
            <UploadCloud className="w-6 h-6 mr-3 text-green-500" />
            Envoyer des vidéos
          </h2>

          <form onSubmit={handleUpload} className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10">
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-400 mb-1">Qui envoie ?</label>
                  <input 
                    type="text" 
                    value={uploaderName}
                    onChange={(e) => setUploaderName(e.target.value)}
                    placeholder="Ex: Gorillat" 
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500 transition-all"
                    disabled={isUploading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-400 mb-1">Type de vidéo</label>
                  <div className="flex bg-neutral-950 p-1 rounded-xl border border-neutral-800 h-[50px]">
                    <button type="button" onClick={() => setVideoType('brute')} className={`flex-1 text-sm font-semibold rounded-lg transition-all ${videoType === 'brute' ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-white'}`}>Brutes</button>
                    <button type="button" onClick={() => setVideoType('montee')} className={`flex-1 text-sm font-semibold rounded-lg transition-all ${videoType === 'montee' ? 'bg-green-600 text-white' : 'text-neutral-500 hover:text-white'}`}>Finale</button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1">Titre du lot</label>
                <input 
                  type="text" 
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                  placeholder="Ex: TROLL EN LOBBY" 
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500 transition-all"
                  disabled={isUploading}
                />
              </div>

              {videoType === 'montee' && (
                <div className="p-4 bg-neutral-950/50 border border-neutral-800 rounded-xl">
                  <label className="block text-sm font-medium text-neutral-400 mb-2 flex items-center">
                    <ImageIcon className="w-4 h-4 mr-2 text-green-500" />
                    Miniature (Optionnel)
                  </label>
                  <div className="flex items-center space-x-4">
                    {thumbnailData && <img src={thumbnailData} alt="Mini" className="w-24 h-[54px] object-cover rounded-lg border border-neutral-700" />}
                    <label className="bg-neutral-800 hover:bg-neutral-700 text-white px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm font-medium">
                      {thumbnailData ? 'Changer' : 'Ajouter une image'}
                      <input type="file" accept="image/*" className="hidden" onChange={handleThumbnailChange} disabled={isUploading} />
                    </label>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4 flex flex-col h-full">
              <div 
                className={`border-2 border-dashed rounded-2xl flex flex-col p-4 flex-1 transition-all min-h-[220px]
                  ${isDragging ? 'border-green-500 bg-green-500/10' : 'border-neutral-700 bg-neutral-950 hover:border-neutral-600'}
                  ${selectedFiles.length > 0 ? 'justify-start' : 'justify-center items-center cursor-pointer'}
                `}
                onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                onClick={() => selectedFiles.length === 0 && fileInputRef.current.click()}
              >
                {selectedFiles.length > 0 ? (
                   <div className="w-full h-full flex flex-col">
                     <div className="flex justify-between items-center mb-3">
                       <span className="text-sm font-bold text-green-500">{selectedFiles.length} vidéo(s) prêtes</span>
                       <button type="button" onClick={() => setSelectedFiles([])} className="text-xs text-red-400 bg-red-400/10 px-2 py-1 rounded">Vider</button>
                     </div>
                     <div className="overflow-y-auto space-y-2 pr-2 flex-1 max-h-[160px] custom-scrollbar mb-3">
                       {selectedFiles.map((f, i) => (
                         <div key={i} className="flex items-center justify-between bg-neutral-800/50 border border-neutral-700 p-2 rounded-lg text-sm">
                           <div className="flex items-center truncate max-w-[80%]">
                             <Video className="w-4 h-4 text-green-500 mr-2 shrink-0" />
                             <span className="truncate text-neutral-200">{f.name}</span>
                           </div>
                           <button type="button" onClick={() => removeFile(i)} className="text-neutral-500 hover:text-red-500 p-1"><X className="w-4 h-4"/></button>
                         </div>
                       ))}
                     </div>
                     <button type="button" onClick={() => fileInputRef.current.click()} className="w-full border border-dashed border-neutral-600 text-neutral-400 hover:text-white py-2 rounded-xl text-sm font-bold">
                        + Ajouter une autre vidéo
                     </button>
                   </div>
                ) : (
                  <div className="text-center pointer-events-none">
                    <Folder className={`w-12 h-12 mx-auto mb-3 transition-colors ${isDragging ? 'text-green-500' : 'text-neutral-600'}`} />
                    <p className="text-white font-bold text-lg mb-1">Glisse tes vidéos ici</p>
                    <p className="text-neutral-400 text-sm mb-2">Un seul lien sera créé pour toutes les vidéos</p>
                  </div>
                )}
                <input type="file" accept="video/*" multiple className="hidden" ref={fileInputRef} onChange={handleFileSelection} disabled={isUploading} />
              </div>

              {isUploading ? (
                <div className="bg-neutral-950 rounded-xl p-4 border border-neutral-800">
                  <div className="flex flex-col text-sm mb-2">
                    <span className="text-green-500 flex items-center font-bold mb-1"><FastForward className="w-4 h-4 mr-2 animate-pulse"/> {uploadStatus}</span>
                    <span className="text-neutral-400 text-xs flex justify-between">Avancement : <strong className="text-white">{Math.round(uploadProgress)}%</strong></span>
                  </div>
                  <div className="w-full bg-neutral-800 rounded-full h-3 overflow-hidden">
                    <div className="bg-green-500 h-full rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                  </div>
                </div>
              ) : (
                <button type="submit" disabled={selectedFiles.length === 0 || !uploaderName || !videoTitle} className="w-full bg-green-600 hover:bg-green-500 text-black font-extrabold text-lg py-4 rounded-xl shadow-[0_0_20px_rgba(34,197,94,0.2)] transition-all disabled:opacity-50 flex items-center justify-center">
                  <UploadCloud className="w-6 h-6 mr-2" /> Générer le lien unique
                </button>
              )}
            </div>
          </form>
        </section>

        {/* LISTES */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <section className="space-y-4">
            <h3 className="text-xl font-bold flex items-center text-neutral-200">
              <Clock className="w-6 h-6 mr-2 text-yellow-500" /> Rushes à Monter <span className="ml-3 bg-neutral-800 text-xs px-2 py-1 rounded-md">{videosBrutes.length}</span>
            </h3>
            {loading ? <p className="text-neutral-500 text-sm">Chargement...</p> : 
         
