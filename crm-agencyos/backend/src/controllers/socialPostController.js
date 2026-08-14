'use strict';
const SocialPost = require('../models/SocialPost');
const SocialPublication = require('../models/SocialPublication');
const SocialAccount = require('../models/SocialAccount');
const socialPostService = require('../modules/social/services/socialPostService');
let sysLog = { info: () => {}, warn: () => {}, error: () => {} };
try { sysLog = require('../utils/sysLogger').logger; } catch {}

async function loadSelectedAccounts(accountIds) {
  if (!Array.isArray(accountIds) || !accountIds.length) return [];
  return SocialAccount.find({ _id: { $in: accountIds } });
}

// @POST /api/social/posts/upload-media
exports.uploadMedia = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const type = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
    res.status(201).json({ success: true, data: { url: `/uploads/${req.file.filename}`, type } });
  } catch (err) { next(err); }
};

// @POST /api/social/posts — creates a draft, or immediately validates +
// publishes/schedules if `publishNow`/`scheduledAt` is provided.
exports.createPost = async (req, res, next) => {
  try {
    const { content = '', title = '', media = [], accountIds = [], scheduledAt, timezone, publishNow } = req.body;

    const accounts = await loadSelectedAccounts(accountIds);
    if (accountIds.length && accounts.length !== accountIds.length) {
      return res.status(400).json({ success: false, message: 'One or more selected accounts could not be found.' });
    }

    const post = await SocialPost.create({
      createdBy: req.user._id,
      content,
      title,
      media,
      timezone: timezone || 'Asia/Kolkata',
      selectedAccounts: accounts.map((a) => a._id),
      status: 'draft',
    });

    if (publishNow || scheduledAt) {
      if (!accounts.length) {
        return res.status(400).json({ success: false, message: 'Select at least one account to publish or schedule.' });
      }
      const check = await socialPostService.validateSelection(accounts, post);
      if (!check.valid) {
        return res.status(400).json({ success: false, message: 'Fix the following before publishing:', errors: check.errors });
      }

      if (publishNow) {
        await socialPostService.publishNow(post, accounts);
        sysLog.info('SOCIAL', `Post "${post._id}" publishing now to ${accounts.length} account(s)`);
      } else {
        post.scheduledAt = new Date(scheduledAt);
        await socialPostService.schedulePost(post, accounts);
        sysLog.info('SOCIAL', `Post "${post._id}" scheduled for ${post.scheduledAt.toISOString()} to ${accounts.length} account(s)`);
      }
    }

    res.status(201).json({ success: true, data: post });
  } catch (err) { next(err); }
};

// @GET /api/social/posts — filters: status, platform, from, to (date range on scheduledAt/createdAt)
exports.getPosts = async (req, res, next) => {
  try {
    const { status, platform, from, to } = req.query;
    const query = { isDeleted: { $ne: true } };
    if (status) query.status = status;
    if (from || to) {
      query.$or = [
        { scheduledAt: { ...(from && { $gte: new Date(from) }), ...(to && { $lte: new Date(to) }) } },
        { scheduledAt: null, createdAt: { ...(from && { $gte: new Date(from) }), ...(to && { $lte: new Date(to) }) } },
      ];
    }

    let posts = await SocialPost.find(query).populate('selectedAccounts', 'platform accountName profileImage').sort({ createdAt: -1 });

    if (platform) {
      const ids = posts.map((p) => p._id);
      const matching = await SocialPublication.find({ socialPost: { $in: ids }, platform }).distinct('socialPost');
      const matchSet = new Set(matching.map(String));
      posts = posts.filter((p) => matchSet.has(String(p._id)));
    }

    res.json({ success: true, data: posts });
  } catch (err) { next(err); }
};

// @GET /api/social/calendar — thin wrapper over getPosts with a date range, same shape
exports.getCalendar = async (req, res, next) => exports.getPosts(req, res, next);

// @GET /api/social/posts/:id
exports.getPost = async (req, res, next) => {
  try {
    const post = await SocialPost.findOne({ _id: req.params.id, isDeleted: { $ne: true } }).populate('selectedAccounts', 'platform accountName profileImage username');
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    const publications = await SocialPublication.find({ socialPost: post._id }).populate('socialAccount', 'platform accountName profileImage username');
    res.json({ success: true, data: { post, publications } });
  } catch (err) { next(err); }
};

// @PATCH /api/social/posts/:id — draft-only edits (content/media/accounts); use /schedule or /publish to move it forward
exports.updatePost = async (req, res, next) => {
  try {
    const post = await SocialPost.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    if (post.status !== 'draft') {
      return res.status(400).json({ success: false, message: 'Only draft posts can be edited directly.' });
    }

    const { content, title, media, accountIds } = req.body;
    if (content !== undefined) post.content = content;
    if (title !== undefined) post.title = title;
    if (media !== undefined) post.media = media;
    if (accountIds !== undefined) {
      const accounts = await loadSelectedAccounts(accountIds);
      post.selectedAccounts = accounts.map((a) => a._id);
    }
    await post.save();
    res.json({ success: true, data: post });
  } catch (err) { next(err); }
};

// @DELETE /api/social/posts/:id
exports.deletePost = async (req, res, next) => {
  try {
    const post = await SocialPost.findOneAndUpdate({ _id: req.params.id, isDeleted: { $ne: true } }, { isDeleted: true }, { new: true });
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
};

// @POST /api/social/posts/:id/publish — publish a draft immediately
exports.publishPost = async (req, res, next) => {
  try {
    const post = await SocialPost.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    if (!['draft'].includes(post.status)) {
      return res.status(400).json({ success: false, message: `Cannot publish a post with status "${post.status}".` });
    }
    const accounts = await SocialAccount.find({ _id: { $in: post.selectedAccounts } });
    if (!accounts.length) return res.status(400).json({ success: false, message: 'Select at least one account first.' });

    const check = await socialPostService.validateSelection(accounts, post);
    if (!check.valid) return res.status(400).json({ success: false, message: 'Fix the following before publishing:', errors: check.errors });

    await socialPostService.publishNow(post, accounts);
    sysLog.info('SOCIAL', `Post "${post._id}" publishing now to ${accounts.length} account(s)`);
    res.json({ success: true, data: post });
  } catch (err) { next(err); }
};

// @POST /api/social/posts/:id/schedule
exports.schedulePost = async (req, res, next) => {
  try {
    const { scheduledAt } = req.body;
    if (!scheduledAt || Number.isNaN(new Date(scheduledAt).getTime())) {
      return res.status(400).json({ success: false, message: 'A valid scheduledAt date/time is required.' });
    }
    if (new Date(scheduledAt).getTime() <= Date.now()) {
      return res.status(400).json({ success: false, message: 'Scheduled time must be in the future.' });
    }

    const post = await SocialPost.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    if (post.status !== 'draft') {
      return res.status(400).json({ success: false, message: `Cannot schedule a post with status "${post.status}".` });
    }
    const accounts = await SocialAccount.find({ _id: { $in: post.selectedAccounts } });
    if (!accounts.length) return res.status(400).json({ success: false, message: 'Select at least one account first.' });

    const check = await socialPostService.validateSelection(accounts, post);
    if (!check.valid) return res.status(400).json({ success: false, message: 'Fix the following before scheduling:', errors: check.errors });

    post.scheduledAt = new Date(scheduledAt);
    await socialPostService.schedulePost(post, accounts);
    sysLog.info('SOCIAL', `Post "${post._id}" scheduled for ${post.scheduledAt.toISOString()} to ${accounts.length} account(s)`);
    res.json({ success: true, data: post });
  } catch (err) { next(err); }
};

// @POST /api/social/posts/:id/cancel
exports.cancelPost = async (req, res, next) => {
  try {
    const post = await SocialPost.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    if (!['scheduled', 'publishing', 'partially_published'].includes(post.status)) {
      return res.status(400).json({ success: false, message: `Cannot cancel a post with status "${post.status}".` });
    }
    await socialPostService.cancelPost(post);
    sysLog.info('SOCIAL', `Post "${post._id}" cancelled`);
    res.json({ success: true, data: post });
  } catch (err) { next(err); }
};

// @POST /api/social/publications/:id/retry — per-publication, not per-post
exports.retryPublication = async (req, res, next) => {
  try {
    const publication = await SocialPublication.findById(req.params.id);
    if (!publication) return res.status(404).json({ success: false, message: 'Publication not found' });
    if (publication.status !== 'failed') {
      return res.status(400).json({ success: false, message: 'Only a failed publication can be retried.' });
    }
    if (publication.retryable === false) {
      return res.status(400).json({ success: false, message: `This failure isn't retryable (${publication.errorCode}) — fix the underlying issue (e.g. reconnect the account) first.` });
    }
    await socialPostService.retryPublication(publication);
    sysLog.info('SOCIAL', `Publication "${publication._id}" (${publication.platform}) manually retried`);
    res.json({ success: true, data: publication });
  } catch (err) { next(err); }
};

// @GET /api/social/analytics — counts from our own records, not each
// platform's Insights API (deep engagement analytics is explicitly deferred).
exports.getAnalytics = async (req, res, next) => {
  try {
    const [postsByStatus, pubsByPlatformStatus] = await Promise.all([
      SocialPost.aggregate([{ $match: { isDeleted: { $ne: true } } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      SocialPublication.aggregate([{ $group: { _id: { platform: '$platform', status: '$status' }, count: { $sum: 1 } } }]),
    ]);

    const byStatus = {};
    for (const row of postsByStatus) byStatus[row._id] = row.count;

    const byPlatform = {};
    for (const row of pubsByPlatformStatus) {
      const { platform, status } = row._id;
      byPlatform[platform] = byPlatform[platform] || {};
      byPlatform[platform][status] = row.count;
    }

    res.json({ success: true, data: { postsByStatus: byStatus, publicationsByPlatform: byPlatform } });
  } catch (err) { next(err); }
};
