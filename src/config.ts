export const config = {
  development: false,
  debug: true,
  appKey: "crash-0.1.0",
  api: `${process.env.NEXT_PUBLIC_API_URL}/api`,
  wss: process.env.NEXT_PUBLIC_API_URL as string,
};
