export const formatSystemTime = (timestamp) => {
  const options = {
    month: "long",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  };
  return new Date(timestamp).toLocaleString("en-GB", options);
};

export const formatDataRate = (bytesPerSecond) => {
  const isNegative = bytesPerSecond < 0;
  const absoluteValue = Math.abs(bytesPerSecond);

  let formattedValue;
  let unit;

  if (absoluteValue >= 1e6) {
    formattedValue = Math.round(absoluteValue / 1e6);
    unit = "MBps";
  } else if (absoluteValue >= 1e3) {
    formattedValue = Math.round(absoluteValue / 1e3);
    unit = "KBps";
  } else {
    formattedValue = Math.round(absoluteValue);
    unit = "Bps";
  }

  return [isNegative ? -formattedValue : formattedValue, unit];
};

export const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1000;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};
