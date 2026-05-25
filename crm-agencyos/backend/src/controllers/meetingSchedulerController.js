const { Meeting, MeetingInvitation } = require('../models');

// POST /api/meetings/schedule
exports.scheduleMeeting = async (req, res, next) => {
  try {
    const { title, description, startTime, endTime, emergencyFlag, invitedUserIds } = req.body;

    if (!title || !startTime || !endTime) {
      return res.status(400).json({ 
        success: false, 
        message: 'Title, startTime, and endTime are required' 
      });
    }

    // Create the core meeting
    const meeting = await Meeting.create({
      title,
      description: description || '',
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      emergencyFlag: !!emergencyFlag,
      createdBy: req.user._id
    });

    let invitations = [];
    if (Array.isArray(invitedUserIds) && invitedUserIds.length > 0) {
      const defaultStatus = !!emergencyFlag ? 'accepted' : 'pending';

      const invitationDocs = invitedUserIds.map((userId) => ({
        meetingId: meeting._id,
        userId,
        status: defaultStatus
      }));

      // Bulk write invitations, compound index checks duplicate constraints automatically
      invitations = await MeetingInvitation.insertMany(invitationDocs);
    }

    res.status(201).json({
      success: true,
      message: `Meeting scheduled successfully${!!emergencyFlag ? ' as emergency forced-join call' : ''}`,
      data: {
        meeting,
        invitations
      }
    });
  } catch (err) {
    console.error('Error in scheduleMeeting:', err);
    next(err);
  }
};

// PUT /api/meetings/rsvp/:invitationId
exports.updateRSVP = async (req, res, next) => {
  try {
    const { invitationId } = req.params;
    const { status } = req.body;

    if (!['accepted', 'declined'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid status. Must be accepted or declined.' 
      });
    }

    // Secure check: verify that the invitation actually belongs to the logged-in user
    const invitation = await MeetingInvitation.findOne({
      _id: invitationId,
      userId: req.user._id
    });

    if (!invitation) {
      return res.status(404).json({ 
        success: false, 
        message: 'Invitation not found or unauthorized' 
      });
    }

    invitation.status = status;
    await invitation.save();

    res.status(200).json({
      success: true,
      message: `RSVP updated successfully to '${status}'`,
      data: invitation
    });
  } catch (err) {
    console.error('Error in updateRSVP:', err);
    next(err);
  }
};

// GET /api/meetings/my-schedule
exports.getMySchedule = async (req, res, next) => {
  try {
    // Return all meetings the user has been invited to, alongside their rsvpStatus
    const invitations = await MeetingInvitation.find({ userId: req.user._id })
      .populate({
        path: 'meetingId',
        populate: { path: 'createdBy', select: 'name email initials color' }
      });

    const schedule = invitations.map((inv) => ({
      invitationId: inv._id,
      rsvpStatus: inv.status,
      meeting: inv.meetingId
    }));

    res.status(200).json({
      success: true,
      data: schedule
    });
  } catch (err) {
    console.error('Error in getMySchedule:', err);
    next(err);
  }
};
