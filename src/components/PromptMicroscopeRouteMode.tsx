import { createElement } from 'react';
import { AlertTriangle, Route } from 'lucide-react';
import type { PromptAssemblyTrace } from '../types';

type RouteModeTrace = NonNullable<PromptAssemblyTrace['routeMode']>;

interface RouteModeSectionProps {
  routeMode?: RouteModeTrace;
}

function formatRouteModeValue(value: RouteModeTrace['requested'] | RouteModeTrace['applied']): string {
  return value ?? 'Unavailable';
}

function formatRouteModeLabel(value: RouteModeTrace['requested'] | RouteModeTrace['applied']): string {
  return formatRouteModeValue(value).toLowerCase();
}

export function RouteModeSection({ routeMode }: RouteModeSectionProps) {
  if (!routeMode) return null;

  const requestedValue = formatRouteModeValue(routeMode.requested);
  const requestedLabel = formatRouteModeLabel(routeMode.requested);
  const appliedValue = formatRouteModeValue(routeMode.applied);
  const appliedLabel = formatRouteModeLabel(routeMode.applied);

  if (!routeMode.fallback) {
    return createElement(
      'div',
      {
        className: 'pm-section',
        role: 'group',
        'aria-label': `Route mode: applied ${appliedLabel}`,
      },
      createElement(
        'div',
        { className: 'pm-section-header' },
        createElement(Route, { size: 12, 'aria-hidden': true }),
        createElement('span', null, 'Route mode'),
      ),
      createElement(
        'div',
        {
          className: 'pm-section-body',
          role: 'list',
          'aria-label': 'Route mode evidence',
        },
        createElement(
          'div',
          {
            className: 'pm-row',
            role: 'listitem',
            'aria-label': `Applied route mode ${appliedLabel}`,
          },
          createElement('span', { className: 'pm-key' }, 'Applied'),
          createElement('span', { className: 'pm-value' }, appliedValue),
        ),
      ),
    );
  }

  return createElement(
    'div',
    {
      className: 'pm-section',
      role: 'group',
      'aria-label': `Route mode fallback: requested ${requestedLabel}, applied ${appliedLabel}`,
    },
    createElement(
      'div',
      { className: 'pm-section-header' },
      createElement(AlertTriangle, { size: 12, 'aria-hidden': true }),
      createElement('span', null, 'Route mode fallback'),
    ),
    createElement(
      'div',
      {
        className: 'pm-section-body',
        role: 'list',
        'aria-label': 'Route mode fallback evidence',
      },
      createElement(
        'div',
        {
          className: 'pm-row',
          role: 'listitem',
          'aria-label': `Requested route mode ${requestedLabel}`,
        },
        createElement('span', { className: 'pm-key' }, 'Requested'),
        createElement('span', { className: 'pm-value' }, requestedValue),
      ),
      createElement(
        'div',
        {
          className: 'pm-row',
          role: 'listitem',
          'aria-label': `Applied route mode ${appliedLabel}`,
        },
        createElement('span', { className: 'pm-key' }, 'Applied'),
        createElement('span', { className: 'pm-value' }, appliedValue),
      ),
      createElement(
        'div',
        { className: 'pm-row pm-row-block', role: 'listitem' },
        createElement('span', { className: 'pm-key' }, 'Reason'),
        createElement('pre', { className: 'pm-pre' }, routeMode.reason),
      ),
    ),
  );
}
