import homeAssistant from '../../server/homeAssistant.cjs';

const {
  getSmartHomeDevices,
  parseJsonBody,
  sendDeviceAction,
  sendError,
  setApiHeaders,
  verifyAdultUser,
} = homeAssistant;

export default async function handler(req, res) {
  setApiHeaders(res, ['GET', 'POST']);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await verifyAdultUser(req);

    if (req.method === 'GET') {
      const result = await getSmartHomeDevices();
      return res.status(200).json(result);
    }

    await sendDeviceAction(parseJsonBody(req));
    return res.status(200).json({ ok: true });
  } catch (err) {
    return sendError(res, err);
  }
}
