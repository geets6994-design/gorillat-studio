html
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gorillat 4K Share</title>
    
    <!-- Tailwind CSS pour le design -->
    <script src="https://cdn.tailwindcss.com"></script>
    
    <!-- Phosphor Icons pour les icônes (optimisé pour ce format) -->
    <script src="https://unpkg.com/@phosphor-icons/web"></script>
    
    <!-- React & ReactDOM -->
    <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
    
    <!-- Babel (Permet à ton navigateur de comprendre React directement) -->
    <script src="https://unpkg.com/babel-standalone@6/babel.min.js"></script>

    <!-- Firebase (Version compatible avec un fichier unique) -->
    <script src="https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/10.8.1/firebase-auth-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore-compat.js"></script>

    <style>
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
    </style>
</head>
<body class="bg-neutral-950 text-neutral-100 font-sans selection:bg-green-500 selection:text-white pb-12">
    
    <div id="root"></div>

    <script type="text/babel">
        // --- TA CONFIGURATION FIREBASE ---
        const firebaseConfig = {
            apiKey: "AIzaSyC-c3lsOdCM--I0wlZBuN2fNeH_2DqxGdY",
            authDomain: "gorillat-shart.firebaseapp.com",
            projectId: "gorillat-shart",
            storageBucket: "gorillat-shart.firebasestorage.app",
            messagingSenderId: "98642718505",
            appId: "1:98642718505:web:d5d0b5ac7715f3c89ed138"
        };

        // Initialisation de Firebase
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        const auth = firebase.auth();
        const db = firebase.firestore();
        const collectionName = 'gorillat_share_videos';

        // Outils React
        const { useState, useEffect, useRef } = React;

        function App() {
            const [user, setUser] = useState(null);
            const [videos, setVideos] = useState([]);
            const [loading, setLoading] = useState(true);
            const [notification, setNotification] = useState({ show: false, message: '', type: 'error' });

            const [uploaderName, setUploaderName] = useState('');
            const [videoTitle, setVideoTitle] = useState('');
            const [videoType, setVideoType] = useState('brute');
            const [selectedFiles, setSelectedFiles] = useState([]);
            const [thumbnailData, setThumbnailData] = useState(null);
            
            const [isUploading, setIsUploading] = useState(false);
            const [uploadProgress, setUploadProgress] = useState(0);
            const [uploadStatus, setUploadStatus] = useState('');
            const [isDragging, setIsDragging] = useState(false);

            const fileInputRef = useRef(null);

            // Connexion invisible
            useEffect(() => {
                auth.signInAnonymously().catch((err) => {
                    console.error("Erreur Firebase:", err);
                    showNotification("Erreur de connexion à Firebase. Vérifie les règles Firestore !", "error");
                });
                
                const unsubscribe = auth.onAuthStateChanged(setUser);
                return () => unsubscribe();
            }, []);

            // Récupération des vidéos
            useEffect(() => {
                if (!user) return;
                
                const unsubscribe = db.collection(collectionName).onSnapshot((snapshot) => {
                    const vids = [];
                    snapshot.forEach((doc) => {
                        vids.push({ id: doc.id, ...doc.data() });
                    });
                    vids.sort((a, b) => {
                        const timeA = a.createdAt ? a.createdAt.toMillis() : 0;
                        const timeB = b.createdAt ? b.createdAt.toMillis() : 0;
                        return timeB - timeA;
                    });
                    setVideos(vids);
                    setLoading(false);
                }, (err) => {
                    console.error("Erreur Firestore:", err);
                    showNotification("Impossible de charger les vidéos.", "error");
                    setLoading(false);
                });

                return () => unsubscribe();
            }, [user]);

            const showNotification = (message, type = 'error') => {
                setNotification({ show: true, message, type });
                setTimeout(() => setNotification({ show: false, message: '', type: 'error' }), 6000);
            };

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

            const uploadToGofile = (file, server, folderId = null) => {
                return new Promise((resolve, reject) => {
                    const xhr = new XMLHttpRequest();
                    xhr.open('POST', `https://${server}.gofile.io/uploadFile`);
                    
                    xhr.upload.onprogress = (e) => {
                        if (e.lengthComputable) setUploadProgress((e.loaded / e.total) * 100);
                    };
                    
                    xhr.onload = () => {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            try {
                                const res = JSON.parse(xhr.responseText);
                                if (res.status === 'ok') resolve(res.data);
                                else reject(new Error("L'API Gofile a refusé l'envoi."));
                            } catch(e) { reject(e); }
                        } else {
                            reject(new Error("Erreur serveur Gofile"));
                        }
                    };
                    
                    xhr.onerror = () => reject(new Error("Erreur réseau. Désactive ton bloqueur de pub."));
                    
                    const formData = new FormData();
                    formData.append('file', file);
                    if (folderId) formData.append('folderId', folderId);
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
                    showNotification("Erreur: Non connecté. Recharge la page.", "error");
                    return;
                }

                setIsUploading(true);
                setUploadProgress(0);

                try {
                    setUploadStatus("Recherche d'un serveur gratuit...");
                    const serverRes = await fetch('https://api.gofile.io/servers');
                    const serverData = await serverRes.json();
                    
                    if (serverData.status !== 'ok') throw new Error("Serveurs indisponibles.");
                    const serverName = serverData.data.servers[0].name;

                    let currentFolderId = null;
                    let finalDownloadLink = null;
                    const uploadedFilesNames = [];

                    for (let i = 0; i < selectedFiles.length; i++) {
                        const file = selectedFiles[i];
                        setUploadStatus(`Envoi vidéo ${i + 1}/${selectedFiles.length}... Ne quitte pas la page !`);
                        setUploadProgress(0); 
                        
                        const data = await uploadToGofile(file, serverName, currentFolderId);
                        
                        if (i === 0) {
                            currentFolderId = data.parentFolder;
                            finalDownloadLink = data.downloadPage;
                        }
                        
                        uploadedFilesNames.push(file.name);
                    }

                    setUploadStatus("Sauvegarde dans la base de données...");
                    setUploadProgress(100);

                    await db.collection(collectionName).add({
                        title: videoTitle,
                        uploader: uploaderName,
                        type: videoType,
                        filesCount: selectedFiles.length,
                        fileNames: uploadedFilesNames,
                        downloadLink: finalDownloadLink,
                        thumbnailData: videoType === 'montee' ? thumbnailData : null,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    });

                    setVideoTitle('');
                    setSelectedFiles([]);
                    setThumbnailData(null);
                    setIsUploading(false);
                    showNotification("Vidéos envoyées avec succès !", "success");
                    
                } catch (err) {
                    showNotification(`L'envoi a échoué: ${err.message}`, "error");
                    setIsUploading(false);
                }
            };

            const videosBrutes = videos.filter(v => v.type === 'brute');
            const videosMontees = videos.filter(v => v.type === 'montee');

            return (
                <React.Fragment>
                    {notification.show && (
                        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-full flex items-center shadow-2xl transition-all w-11/12 max-w-md ${notification.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
                            <i className={`ph-fill ${notification.type === 'error' ? 'ph-warning-circle' : 'ph-check-circle'} text-2xl mr-3 shrink-0`}></i>
                            <span className="font-medium text-sm leading-tight">{notification.message}</span>
                        </div>
                    )}

                    <header className="bg-gradient-to-r from-green-900 to-neutral-900 border-b border-green-800/50 shadow-lg shadow-green-900/20 py-4 px-4 md:px-8 flex items-center justify-between sticky top-0 z-50">
                        <div className="flex items-center space-x-3">
                            <div className="bg-green-500 p-2 rounded-xl shadow-[0_0_15px_rgba(34,197,94,0.5)]">
                                <i className="ph-fill ph-play-circle text-3xl text-black"></i>
                            </div>
                            <div>
                                <h1 className="text-2xl font-extrabold tracking-tight text-white uppercase">Gorillat <span className="text-green-500">Share</span></h1>
                                <p className="text-xs text-green-300 font-medium tracking-wider">Lien Unique • En Ligne</p>
                            </div>
                        </div>
                    </header>

                    <main className="max-w-7xl mx-auto p-4 md:p-8 space-y-10">
                        <div className="bg-blue-500/10 border border-blue-500/30 text-blue-400 p-4 rounded-2xl text-sm flex items-start">
                            <i className="ph-fill ph-info text-2xl mr-3 shrink-0 mt-0.5"></i>
                            <div>
                                <strong className="block text-base mb-1">📱 Astuce de sélection :</strong>
                                Sur téléphone, <b>reste appuyé longtemps</b> sur la première vidéo dans ta galerie, puis coche les autres. Le site créera <b>un seul lien</b> pour toutes les télécharger d'un coup !
                            </div>
                        </div>

                        <section className="bg-neutral-900 rounded-3xl border border-neutral-800 p-6 md:p-8 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
                            
                            <h2 className="text-xl md:text-2xl font-bold mb-6 flex items-center">
                                <i className="ph-fill ph-cloud-arrow-up text-2xl mr-3 text-green-500"></i>
                                Envoyer des vidéos
                            </h2>

                            <form onSubmit={handleUpload} className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10">
                                <div className="space-y-5">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-neutral-400 mb-1">Qui envoie ?</label>
                                            <input type="text" value={uploaderName} onChange={(e) => setUploaderName(e.target.value)} placeholder="Ex: Gorillat" className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500 transition-all" disabled={isUploading} />
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
                                        <input type="text" value={videoTitle} onChange={(e) => setVideoTitle(e.target.value)} placeholder="Ex: TROLL EN LOBBY" className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500 transition-all" disabled={isUploading} />
                                    </div>

                                    {videoType === 'montee' && (
                                        <div className="p-4 bg-neutral-950/50 border border-neutral-800 rounded-xl">
                                            <label className="block text-sm font-medium text-neutral-400 mb-2 flex items-center">
                                                <i className="ph-fill ph-image text-lg mr-2 text-green-500"></i>
                                                Miniature (Optionnel)
                                            </label>
                                            <div className="flex items-center space-x-4">
                                                {thumbnailData && <img src={thumbnailData} alt="Miniature" className="w-24 h-[54px] object-cover rounded-lg border border-neutral-700" />}
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
                                        className={`border-2 border-dashed rounded-2xl flex flex-col p-4 flex-1 transition-all min-h-[220px] ${isDragging ? 'border-green-500 bg-green-500/10' : 'border-neutral-700 bg-neutral-950 hover:border-neutral-600'} ${selectedFiles.length > 0 ? 'justify-start' : 'justify-center items-center cursor-pointer'}`}
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
                                                                <i className="ph-fill ph-video-camera text-base text-green-500 mr-2 shrink-0"></i>
                                                                <span className="truncate text-neutral-200">{f.name}</span>
                                                            </div>
                                                            <button type="button" onClick={() => removeFile(i)} className="text-neutral-500 hover:text-red-500 p-1">
                                                                <i className="ph-bold ph-x text-base"></i>
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                                <button type="button" onClick={() => fileInputRef.current.click()} className="w-full border border-dashed border-neutral-600 text-neutral-400 hover:text-white py-2 rounded-xl text-sm font-bold">
                                                    + Ajouter une autre vidéo
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="text-center pointer-events-none">
                                                <i className={`ph-fill ph-folder text-5xl mx-auto mb-3 transition-colors ${isDragging ? 'text-green-500' : 'text-neutral-600'}`}></i>
                                                <p className="text-white font-bold text-lg mb-1">Glisse tes vidéos ici</p>
                                                <p className="text-neutral-400 text-sm mb-2">Un seul lien sera créé pour toutes les vidéos</p>
                                            </div>
                                        )}
                                        <input type="file" accept="video/*" multiple className="hidden" ref={fileInputRef} onChange={handleFileSelection} disabled={isUploading} />
                                    </div>

                                    {isUploading ? (
                                        <div className="bg-neutral-950 rounded-xl p-4 border border-neutral-800">
                                            <div className="flex flex-col text-sm mb-2">
                                                <span className="text-green-500 flex items-center font-bold mb-1">
                                                    <i className="ph-fill ph-fast-forward text-base mr-2 animate-pulse"></i> {uploadStatus}
                                                </span>
                                                <span className="text-neutral-400 text-xs flex justify-between">Avancement : <strong className="text-white">{Math.round(uploadProgress)}%</strong></span>
                                            </div>
                                            <div className="w-full bg-neutral-800 rounded-full h-3 overflow-hidden">
                                                <div className="bg-green-500 h-full rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                                            </div>
                                        </div>
                                    ) : (
                                        <button type="submit" disabled={selectedFiles.length === 0 || !uploaderName || !videoTitle} className="w-full bg-green-600 hover:bg-green-500 text-black font-extrabold text-lg py-4 rounded-xl shadow-[0_0_20px_rgba(34,197,94,0.2)] transition-all disabled:opacity-50 flex items-center justify-center">
                                            <i className="ph-fill ph-cloud-arrow-up text-2xl mr-3"></i> Générer le lien unique
                                        </button>
                                    )}
                                </div>
                            </form>
                        </section>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <section className="space-y-4">
                                <h3 className="text-xl font-bold flex items-center text-neutral-200">
                                    <i className="ph-fill ph-clock text-2xl mr-2 text-yellow-500"></i> Rushes à Monter 
                                    <span className="ml-3 bg-neutral-800 text-xs px-2 py-1 rounded-md">{videosBrutes.length}</span>
                                </h3>
                                {loading ? <p className="text-neutral-500 text-sm">Chargement...</p> : 
                                 videosBrutes.length === 0 ? <p className="text-neutral-600 bg-neutral-900 p-6 rounded-2xl text-center border border-neutral-800">Rien à monter pour le moment.</p> :
                                 videosBrutes.map(video => <VideoCard key={video.id} video={video} />)}
                            </section>

                            <section className="space-y-4">
                                <h3 className="text-xl font-bold flex items-center text-neutral-200">
                                    <i className="ph-fill ph-check-circle text-2xl mr-2 text-green-500"></i> Vidéos Finales 
                                    <span className="ml-3 bg-neutral-800 text-xs px-2 py-1 rounded-md">{videosMontees.length}</span>
                                </h3>
                                {loading ? <p className="text-neutral-500 text-sm">Chargement...</p> : 
                                 videosMontees.length === 0 ? <p className="text-neutral-600 bg-neutral-900 p-6 rounded-2xl text-center border border-neutral-800">Aucune vidéo terminée.</p> :
                                 videosMontees.map(video => <VideoCard key={video.id} video={video} isFinal={true} />)}
                            </section>
                        </div>
                    </main>
                </React.Fragment>
            );
        }

        function VideoCard({ video, isFinal = false }) {
            const formatDate = (timestamp) => {
                if (!timestamp || !timestamp.toDate) return 'À l\'instant';
                return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(timestamp.toDate());
            };

            return (
                <div className={`group bg-neutral-900 border rounded-3xl p-5 transition-all ${isFinal ? 'border-green-900/50' : 'border-neutral-800'}`}>
                    {isFinal && video.thumbnailData && (
                        <div className="w-full h-32 md:h-48 mb-5 rounded-2xl overflow-hidden relative border border-neutral-800">
                            <img src={video.thumbnailData} alt="Miniature" className="w-full h-full object-cover" />
                            <div className="absolute top-3 right-3 bg-black/80 backdrop-blur text-white text-xs px-3 py-1.5 rounded-lg flex items-center font-bold">
                                <i className="ph-fill ph-check-circle text-base mr-1.5 text-green-500"></i> Terminée
                            </div>
                        </div>
                    )}
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-5">
                        <div className="min-w-0 flex-1">
                            <h4 className="font-extrabold text-white text-lg md:text-xl mb-2">{video.title}</h4>
                            <div className="flex items-center text-xs text-neutral-500 mb-4 space-x-3">
                                <span className="bg-neutral-800 px-2.5 py-1 rounded-md text-neutral-300 font-medium">De {video.uploader}</span>
                                <span>•</span>
                                <span>{formatDate(video.createdAt)}</span>
                            </div>
                            <div className="flex items-center text-sm text-neutral-400 mb-2">
                                <i className="ph-fill ph-folder text-base mr-2"></i> Dossier de {video.filesCount || 1} vidéo(s)
                            </div>
                        </div>
                        
                        <a 
                            href={video.downloadLink || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`shrink-0 flex items-center justify-center py-3 px-5 rounded-xl font-bold text-sm h-fit w-full md:w-auto ${isFinal ? 'bg-white text-black' : 'bg-green-600 text-black'}`}
                        >
                            Ouvrir le dossier <i className="ph-bold ph-arrow-square-out text-base ml-2"></i>
                        </a>
                    </div>
                </div>
            );
        }

        // Lancement de l'application
        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(<App />);
    </script>
</body>
</html>

```
