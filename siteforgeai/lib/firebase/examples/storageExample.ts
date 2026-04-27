import { getDownloadURL, ref, uploadString } from "firebase/storage";
import { firebase } from "../index";

export async function exampleUploadTextFile(
  objectPath: string,
  data: string,
  format: "raw" | "base64" | "base64url" | "data_url" = "raw"
) {
  const r = ref(firebase.storage, objectPath);
  await uploadString(r, data, format);
  return getDownloadURL(r);
}
