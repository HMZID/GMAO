/**
 * Adresse du serveur GMAO. À définir par EXPO_PUBLIC_API_URL (fichier mobile/.env) :
 * - émulateur Android : http://10.0.2.2:3000 ;
 * - téléphone sur le même réseau que le poste de développement : http://<adresse IP du poste>:3000 ;
 * - production : https://gmao.example.fr (HTTPS obligatoire, TEC-06).
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:3000";
