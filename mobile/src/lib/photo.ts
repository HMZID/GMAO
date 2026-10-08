import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

/**
 * Photo d'intervention (MOB-05) : prise de vue, puis compression avant stockage et envoi
 * (§10.4 : 1 920 px de large et environ 1 Mo au plus).
 */
export async function takeCompressedPhoto(): Promise<{ uri: string; fileName: string } | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) throw new Error("Autoriser la caméra pour photographier l'intervention.");
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1, exif: false });
  if (result.canceled || result.assets.length === 0) return null;
  const asset = result.assets[0];
  const context = ImageManipulator.manipulate(asset.uri);
  if ((asset.width ?? 0) > 1920) context.resize({ width: 1920 });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return { uri: saved.uri, fileName: `photo-${stamp}.jpg` };
}
