'use strict';
const ApiKey = require('../models/ApiKey');
const audit = require('../services/auditService');

// @GET /api/api-keys — admin only. Never returns hashedKey (select:false on
// the schema already excludes it; nothing here opts back in).
exports.getApiKeys = async (req, res, next) => {
  try {
    const keys = await ApiKey.find({}).populate('createdBy', 'name email').sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: keys });
  } catch (err) { next(err); }
};

// @POST /api/api-keys — body: { name }. Raw key is returned ONCE here, never
// again — same "never re-displayed" pattern as TrackedWebsite.apiSecret.
exports.createApiKey = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }

    const rawKey = ApiKey.generateKey();
    const key = await ApiKey.create({
      name: name.trim(),
      keyPrefix: rawKey.slice(0, 14),
      hashedKey: ApiKey.hash(rawKey),
      createdBy: req.user?._id,
    });

    audit.log(req, {
      action: 'create', category: 'api_key',
      targetId: key._id, targetModel: 'ApiKey', targetTitle: key.name,
    });

    // select:false on the schema only applies to query results (find/
    // findOne) — a document straight out of .create() still has hashedKey
    // populated in memory, so it must be stripped by hand here or it leaks
    // in this response (harmless on its own since resolve() always re-hashes
    // whatever's presented, so a captured hash alone can't authenticate, but
    // it's still an internal implementation detail that shouldn't ship).
    const obj = key.toObject();
    delete obj.hashedKey;
    res.status(201).json({ success: true, data: { ...obj, key: rawKey } }); // plaintext, this one time only
  } catch (err) { next(err); }
};

// @DELETE /api/api-keys/:id — revokes immediately; any caller still using
// this key's secret starts getting 401s on its next request.
exports.deleteApiKey = async (req, res, next) => {
  try {
    const key = await ApiKey.findById(req.params.id);
    if (!key) return res.status(404).json({ success: false, message: 'API key not found' });

    await key.deleteOne();

    audit.log(req, {
      action: 'delete', category: 'api_key',
      targetId: key._id, targetModel: 'ApiKey', targetTitle: key.name,
    });

    res.json({ success: true, message: `"${key.name}" revoked` });
  } catch (err) { next(err); }
};
