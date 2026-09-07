"use client";

import React, { useState } from "react";
import { ModalOverlay } from "@/components/ui/modal-overlay";

interface Transaction {
  id: string;
  title: string;
  date: string;
  points: number;
  type: "earned" | "redeemed";
  category: string;
}

const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: "tx-1",
    title: "Stay at Villa Breeze Malibu",
    date: "Aug 15, 2026",
    points: 500,
    type: "earned",
    category: "Booking",
  },
  {
    id: "tx-2",
    title: "Verified Guest Review",
    date: "Aug 18, 2026",
    points: 50,
    type: "earned",
    category: "Review",
  },
  {
    id: "tx-3",
    title: "Welcome Homie Bonus",
    date: "Jun 10, 2026",
    points: 250,
    type: "earned",
    category: "Bonus",
  },
  {
    id: "tx-4",
    title: "$10 Booking Discount Voucher",
    date: "Jul 02, 2026",
    points: -1000,
    type: "redeemed",
    category: "Reward",
  },
];

const REWARDS = [
  {
    id: "rew-1",
    title: "$10 Stay Credit",
    points: 1000,
    description: "Instant discount on any stay of $100 or more.",
    badge: "Popular",
  },
  {
    id: "rew-2",
    title: "$25 Stay Credit",
    points: 2500,
    description: "Instant discount on any stay of $200 or more.",
    badge: "Best Value",
  },
  {
    id: "rew-3",
    title: "Early Check-in (2 hrs)",
    points: 600,
    description: "Guaranteed check-in 2 hours before standard time.",
  },
  {
    id: "rew-4",
    title: "Late Check-out (2 hrs)",
    points: 600,
    description: "Relax longer with 2 hours extra before departure.",
  },
  {
    id: "rew-5",
    title: "Homie Welcome Basket",
    points: 1500,
    description: "Locally sourced treats and wine waiting at arrival.",
  },
];

export function LoyaltyWalletView() {
  const [balance, setBalance] = useState(2450);
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);
  const [redeemingReward, setRedeemingReward] = useState<(typeof REWARDS)[0] | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleRedeem = (reward: (typeof REWARDS)[0]) => {
    if (balance < reward.points) {
      setToastMessage(`You need ${reward.points - balance} more points for this reward.`);
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }
    setRedeemingReward(reward);
  };

  const confirmRedeem = () => {
    if (!redeemingReward) return;
    setBalance((prev) => prev - redeemingReward.points);
    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      title: `${redeemingReward.title} Voucher`,
      date: "Just now",
      points: -redeemingReward.points,
      type: "redeemed",
      category: "Reward",
    };
    setTransactions((prev) => [newTx, ...prev]);
    const name = redeemingReward.title;
    setRedeemingReward(null);
    setToastMessage(`Success! You redeemed "${name}". Voucher code added to your wallet.`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <div className="flex flex-col animate-in fade-in duration-300">
      {/* Title Header */}
      <div className="mb-6 lg:mb-8">
        <h2 className="text-[22px] leading-[30px] font-medium tracking-[-0.02em] text-[#1F1F1F] sm:text-[28px] sm:leading-[36px] lg:text-[32px] lg:leading-[40px] xl:text-[36px] xl:leading-[44px]">
          Loyalty Points Wallet
        </h2>
        <p className="mt-1 text-sm leading-5 text-[#727272] sm:text-base sm:leading-6">
          Earn points on every booking and redeem them for free nights, discounts, and travel perks.
        </p>
      </div>

      {toastMessage && (
        <div className="mb-6 rounded-2xl bg-[#FFF8E8] border border-[#FCDF9C] px-4 py-3 text-sm font-medium text-[#1F1F1F] animate-in fade-in">
          {toastMessage}
        </div>
      )}

      {/* Hero Balance Card */}
      <div className="relative mb-8 overflow-hidden rounded-3xl border border-[#E5E5E5] bg-gradient-to-br from-[#FFF8E8] via-white to-[#FDF4D8] p-6 shadow-xs sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#727272]">
              Current Balance
            </span>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold tracking-tight text-[#1F1F1F] sm:text-5xl">
                {balance.toLocaleString()}
              </span>
              <span className="text-base font-semibold text-[#727272] sm:text-lg">
                Points
              </span>
            </div>
            <p className="text-xs font-medium text-[#1F1F1F]/80 sm:text-sm">
              ≈ ${(balance * 0.01).toFixed(2)} USD in stay credit
            </p>
          </div>

          <div className="flex flex-col items-start sm:items-end gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FCDF9C] px-3.5 py-1 text-xs font-semibold text-[#1F1F1F]">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              Homie Explorer Tier
            </span>
            <span className="text-xs text-[#727272]">
              {5000 - balance > 0 ? `${5000 - balance} pts to Homie VIP` : "VIP Tier unlocked!"}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-6">
          <div className="h-2 w-full overflow-hidden rounded-full bg-[#EFEFEF]">
            <div
              className="h-full rounded-full bg-[#FCDF9C] transition-all duration-500"
              style={{ width: `${Math.min(100, (balance / 5000) * 100)}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-[#727272]">
            <span>Base (0)</span>
            <span>Explorer (2,000)</span>
            <span>VIP (5,000)</span>
          </div>
        </div>
      </div>

      {/* Ways to Earn 3-Column Strip */}
      <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col rounded-2xl border border-[#E5E5E5] bg-white p-4">
          <span className="text-xs font-bold text-[#1F1F1F]">Book a Stay</span>
          <span className="mt-1 text-lg font-bold text-[#1F1F1F]">10 pts / $1</span>
          <span className="mt-0.5 text-xs text-[#727272]">Earn on all homes &amp; villas</span>
        </div>
        <div className="flex flex-col rounded-2xl border border-[#E5E5E5] bg-white p-4">
          <span className="text-xs font-bold text-[#1F1F1F]">Write Reviews</span>
          <span className="mt-1 text-lg font-bold text-[#1F1F1F]">50 pts each</span>
          <span className="mt-0.5 text-xs text-[#727272]">After every completed trip</span>
        </div>
        <div className="flex flex-col rounded-2xl border border-[#E5E5E5] bg-white p-4">
          <span className="text-xs font-bold text-[#1F1F1F]">Refer Friends</span>
          <span className="mt-1 text-lg font-bold text-[#1F1F1F]">250 pts</span>
          <span className="mt-0.5 text-xs text-[#727272]">When friend completes first stay</span>
        </div>
      </div>

      {/* Available Rewards Grid */}
      <div className="mb-10">
        <h3 className="mb-4 text-lg font-semibold text-[#1F1F1F] sm:text-xl">
          Redeem Rewards
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {REWARDS.map((reward) => {
            const canAfford = balance >= reward.points;
            return (
              <div
                key={reward.id}
                className="relative flex flex-col justify-between rounded-2xl border border-[#E5E5E5] bg-white p-5 transition-all hover:border-[#1F1F1F]/40 hover:shadow-xs"
              >
                {reward.badge && (
                  <span className="absolute right-4 top-4 rounded-full bg-[#FFF8E8] border border-[#FCDF9C] px-2.5 py-0.5 text-[10px] font-semibold text-[#1F1F1F]">
                    {reward.badge}
                  </span>
                )}
                <div>
                  <h4 className="text-base font-semibold text-[#1F1F1F]">
                    {reward.title}
                  </h4>
                  <p className="mt-1 text-xs text-[#727272] leading-relaxed">
                    {reward.description}
                  </p>
                  <p className="mt-3 text-sm font-bold text-[#1F1F1F]">
                    {reward.points.toLocaleString()} pts
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRedeem(reward)}
                  disabled={!canAfford}
                  className={`mt-4 w-full rounded-full py-2 text-xs font-semibold transition-colors ${
                    canAfford
                      ? "bg-[#FCDF9C] text-[#1F1F1F] hover:bg-[#F7D37D]"
                      : "cursor-not-allowed bg-zinc-100 text-zinc-400"
                  }`}
                >
                  {canAfford ? "Redeem Reward" : "Need more points"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Points History */}
      <div>
        <h3 className="mb-4 text-lg font-semibold text-[#1F1F1F] sm:text-xl">
          Points Activity
        </h3>
        <div className="divide-y divide-[#E5E5E5] rounded-2xl border border-[#E5E5E5] bg-white">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between p-4 transition-colors hover:bg-zinc-50"
            >
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-[#1F1F1F]">{tx.title}</span>
                <span className="text-xs text-[#727272]">{tx.date} • {tx.category}</span>
              </div>
              <span
                className={`text-sm font-bold ${
                  tx.points > 0 ? "text-emerald-700" : "text-zinc-700"
                }`}
              >
                {tx.points > 0 ? `+${tx.points}` : tx.points} pts
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Redemption Confirmation Modal */}
      {redeemingReward && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-lg font-semibold text-[#1F1F1F]">
              Confirm Reward Redemption
            </h3>
            <p className="mt-2 text-sm text-[#727272]">
              Are you sure you want to redeem <strong>{redeemingReward.points.toLocaleString()} points</strong> for <strong>{redeemingReward.title}</strong>?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setRedeemingReward(null)}
                className="rounded-full px-5 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRedeem}
                className="rounded-full bg-[#FCDF9C] px-5 py-2 text-xs font-semibold text-[#1F1F1F] hover:bg-[#F7D37D]"
              >
                Confirm &amp; Deduct
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
