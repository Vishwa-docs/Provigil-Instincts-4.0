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
      return 'text-green-600';
    case 'warning':
    case 'degraded':
    case 'in_progress':
    case 'pending':
      return 'text-orange-500';
    case 'critical':
    case 'failure':
    case 'overdue':
      return 'text-red-500';
    case 'info':
    case 'new':
      return 'text-blue-500';
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
      return 'bg-green-50 text-green-700 border-green-200';
    case 'warning':
    case 'degraded':
    case 'in_progress':
    case 'pending':
      return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'critical':
    case 'failure':
    case 'overdue':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'info':
    case 'new':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    default:
      return 'bg-gray-50 text-gray-600 border-gray-200';
  }
}

export function getSeverityColor(severity) {
  const s = (severity || '').toLowerCase();
  switch (s) {
    case 'critical':
      return 'text-red-600';
    case 'high':
      return 'text-orange-600';
    case 'medium':
    case 'warning':
      return 'text-orange-500';
    case 'low':
    case 'info':
      return 'text-blue-500';
    default:
      return 'text-gray-400';
  }
}

export function getSeverityBgColor(severity) {
  const s = (severity || '').toLowerCase();
  switch (s) {
    case 'critical':
      return 'bg-red-50 text-red-700 border border-red-200';
    case 'high':
      return 'bg-orange-50 text-orange-700 border border-orange-200';
    case 'medium':
    case 'warning':
      return 'bg-orange-50 text-orange-600 border border-orange-200';
    case 'low':
    case 'info':
      return 'bg-blue-50 text-blue-700 border border-blue-200';
    default:
      return 'bg-gray-50 text-gray-600 border border-gray-200';
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
  if (score >= 85) return 'text-green-600';
  if (score >= 70) return 'text-blue-600';
  if (score >= 50) return 'text-orange-500';
  return 'text-red-500';
}

export function getHealthScoreBg(score) {
  if (score === null || score === undefined) return 'bg-gray-50';
  if (score >= 85) return 'bg-green-50';
  if (score >= 70) return 'bg-blue-50';
  if (score >= 50) return 'bg-orange-50';
  return 'bg-red-50';
}

export function classNames(...classes) {
  return clsx(...classes);
}

export function truncate(str, length = 30) {
  if (!str) return '';
  return str.length > length ? str.slice(0, length) + '...' : str;
}

export function formatIssueLabel(label) {
  if (!label) return '—';
  // If already contains spaces or em-dash, it's a clean label from backend
  if (label.includes(' ') || label.includes('—')) return label;
  // Legacy snake_case fallback: convert to title case
  return label
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
