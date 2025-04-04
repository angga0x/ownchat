// This file is used to track MongoDB connection status
// and avoid circular dependencies

let mongodbFailed = false;

export function setMongoFailed(failed: boolean) {
  mongodbFailed = failed;
}

export function isMongoFailed() {
  return mongodbFailed;
}