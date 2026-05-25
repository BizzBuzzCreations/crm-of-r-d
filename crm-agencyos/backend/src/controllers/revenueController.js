const { Revenue } = require('../models');

// GET /api/revenue/summary
exports.getRevenueSummary = async (req, res, next) => {
  try {
    const summary = await Revenue.aggregate([
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                totalRevenue: {
                  $sum: {
                    $cond: [{ $eq: ['$status', 'received'] }, '$amount', 0]
                  }
                },
                pendingBalance: {
                  $sum: {
                    $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0]
                  }
                }
              }
            }
          ],
          breakdown: [
            {
              $group: {
                _id: '$source',
                total: { $sum: '$amount' },
                count: { $sum: 1 },
                received: {
                  $sum: {
                    $cond: [{ $eq: ['$status', 'received'] }, '$amount', 0]
                  }
                },
                pending: {
                  $sum: {
                    $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0]
                  }
                }
              }
            },
            { $sort: { total: -1 } }
          ]
        }
      }
    ]);

    const totals = summary[0]?.totals[0] || { totalRevenue: 0, pendingBalance: 0 };
    const breakdown = summary[0]?.breakdown || [];

    res.status(200).json({
      success: true,
      data: {
        totalRevenue: totals.totalRevenue,
        pendingBalance: totals.pendingBalance,
        breakdown
      }
    });
  } catch (err) {
    console.error('Error in getRevenueSummary aggregation:', err);
    next(err);
  }
};

// POST /api/revenue/record
exports.recordRevenue = async (req, res, next) => {
  try {
    const { amount, currency, source, status, date } = req.body;

    if (!amount || !source) {
      return res.status(400).json({ 
        success: false, 
        message: 'Amount and source are required fields' 
      });
    }

    const revenueRecord = await Revenue.create({
      amount,
      currency: currency || 'INR',
      source,
      status: status || 'pending',
      processedBy: req.user._id,
      date: date || new Date()
    });

    res.status(201).json({
      success: true,
      message: 'Revenue record created successfully',
      data: revenueRecord
    });
  } catch (err) {
    console.error('Error in recordRevenue:', err);
    next(err);
  }
};
