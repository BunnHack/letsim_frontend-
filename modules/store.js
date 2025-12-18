export const fileContents = {};

export function setFileContent(path, content) {
  fileContents[path] = content;
}

export function getFileContent(path) {
  return fileContents[path] ?? '';
}

export function getAllFiles() {
  return Object.keys(fileContents).sort();
}

export function hasFile(path) {
  return Object.prototype.hasOwnProperty.call(fileContents, path);
}

