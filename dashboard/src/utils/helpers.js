import { format, formatDistanceToNow, parseISO } from 'date-fns';
import clsx from 'clsx';

export function formatDate(date, pattern = 'MMM d, yyyy HH:mm') {
  if (!date) return '—';
  const parsed = typeof date === 'string' ? parseISO(date) : date;
  return format(parsed, pattern);
}

export function formatRelativeDate(date) {
  if (!date) return '—';
  const parsed = typeof date === 'string' ? parseISO(date) : date;
  return formatDistanceToNow(parsed, { addSuffix: true });
}

export function getStatusColor(status) {
  const s = (status || '').toLowerCase();
  switch (s) {
    case 'healthy':
    case 'normal':
    case 'resolved':
    case 'completed':
      return 'text-emerald-400';
    case 'warning':
    case 'degraded':
    case 'in_progress':
    case 'pending':
      return 'text-amber-400';
    case 'critical':
    case 'failure':
    case 'overdue':
      return 'text-red-400';
    case 'info':
    case 'new':
      return 'text-blue-400';
    default:
      return 'text-gray-400';
  }
}

export function getStatusBgColor(status) {
  const s = (status || '').toLowerCase();
  switch (s) {
    case 'healthy':
    case 'normal':
    case 'resolved':
    case 'completed':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20';
    case 'warning':
    case 'degraded':
    case 'in_progress':
    case 'pending':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/20';
    case 'critical':
    case 'failure':
    case 'overdue':
      return 'bg-red-500/15 text-red-400 border-red-500/20';
    case 'info':
    case 'new':
      return 'bg-blue-500/15 text-blue-400 border-blue-500/20';
    default:
      return 'bg-gray-500/15 text-gray-400 border-gray-500/20';
  }
}

export function getSeverityColor(severity) {
  const s = (severity || '').toLowerCase();
  switch (s) {
    case 'critical':
      return 'text-red-400';
    case 'high':
      return 'text-orange-400';
    case 'medium':
    case 'warning':
      return 'text-amber-400';
    case 'low':
    case 'info':
      return 'text-blue-400';
    default:
      return 'text-gray-400';
  }
}

export function getSeverityBgColor(severity) {
  const s = (severity || '').toLowerCase();
  switch (s) {
    case 'critical':
      return 'bg-red-500/15 text-red-400 border border-red-500/20';
    case 'high':
      return 'bg-orange-500/15 text-orange-400 border border-orange-500/20';
    case 'medium':
    case 'warning':
      return 'bg-amber-500/15 text-amber-400 border border-amber-500/20';
    case 'low':
    case 'info':
      return 'bg-blue-500/15 text-blue-400 border border-blue-500/20';
    default:
      return 'bg-gray-500/15 text-gray-400 border border-gray-500/20';
  }
}

export function formatNumber(num, decimals = 0) {
  if (num === null || num === undefined) return '—';
  if (typeof num !== 'number') num = Number(num);
  if (isNaN(num)) return '—';

  if (Math.abs(num) >= 1_000_000) {
    return (num / 1_000_000).toFixed(1) + 'M';
  }
  if (Math.abs(num) >= 1_000) {
    return (num / 1_000).toFixed(1) + 'K';
  }
  return num.toFixed(decimals);
}

export function getHealthScoreLabel(score) {
  if (score === null || score === undefined) return 'Unknown';
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Warning';
  return 'Critical';
}

export function getHealthScoreColor(score) {
  if (score === null || score === undefined) return 'text-gray-400';
  if (score >= 85) return 'text-emerald-400';
  if (score >= 70) return 'text-blue-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-red-400';
}

export function getHealthScoreBg(score) {
  if (score === null || score === undefined) return 'bg-gray-500/15';
  if (score >= 85) return 'bg-emerald-500/15';
  if (score >= 70) return 'bg-blue-500/15';
  if (score >= 50) return 'bg-amber-500/15';
  return 'bg-red-500/15';
}

export function classNames(...classes) {
  return clsx(...classes);
}

export function truncate(str, length = 30) {
  if (!str) return '';
  return str.length > length ? str.slice(0, length) + '...' : str;
}
