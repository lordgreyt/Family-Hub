import homeAssistant from '../../../server/homeAssistant.cjs';

const {
  parseJsonBody,
  sendCoverAction,
  sendError,
  setApiHeaders,
  verifyAdultUser,
} = homeAssistant;

export default async function handler(req, res) {
  setApiHeaders(res, ['POST']);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await verifyAdultUser(req);
    await sendCoverAction(parseJsonBody(req));
    return res.status(200).json({ ok: true });
  } catch (err) {
    return sendError(res, err);
  }
}
