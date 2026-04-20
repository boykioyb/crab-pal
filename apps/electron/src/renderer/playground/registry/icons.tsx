import type { ComponentEntry } from './types'
import { CrabPalBrandMark } from '@/components/icons/CrabPalBrandMark'
import { CrabPalLogo } from '@/components/icons/CrabPalLogo'
import { CrabPalSymbol } from '@/components/icons/CrabPalSymbol'
import { PanelLeftRounded } from '@/components/icons/PanelLeftRounded'
import { SquarePenRounded } from '@/components/icons/SquarePenRounded'

export const iconComponents: ComponentEntry[] = [
  {
    id: 'crabpal-brand-mark',
    name: 'CrabPalBrandMark',
    category: 'Icons',
    description: 'Unified CrabPal brand mark — single source of truth for logo rendering',
    component: CrabPalBrandMark,
    props: [
      {
        name: 'size',
        description: 'xs | sm | md | lg | xl',
        control: { type: 'string' },
        defaultValue: 'md',
      },
      {
        name: 'variant',
        description: 'plain | soft | hero',
        control: { type: 'string' },
        defaultValue: 'soft',
      },
    ],
    variants: [
      { name: 'Soft md', props: { size: 'md', variant: 'soft' } },
      { name: 'Soft lg', props: { size: 'lg', variant: 'soft' } },
      { name: 'Hero xl', props: { size: 'xl', variant: 'hero' } },
      { name: 'Plain sm', props: { size: 'sm', variant: 'plain' } },
      { name: 'Plain xs', props: { size: 'xs', variant: 'plain' } },
    ],
  },
  {
    id: 'crabpal-logo',
    name: 'CrabPalLogo',
    category: 'Icons',
    description: 'Full CrabPal branding logo with wordmark',
    component: CrabPalLogo,
    props: [
      {
        name: 'className',
        description: 'Tailwind classes for sizing and styling',
        control: { type: 'string' },
        defaultValue: 'h-8',
      },
    ],
    variants: [
      { name: 'Small', props: { className: 'h-6' } },
      { name: 'Medium', props: { className: 'h-8' } },
      { name: 'Large', props: { className: 'h-12' } },
    ],
  },
  {
    id: 'crabpal-symbol',
    name: 'CrabPalSymbol',
    category: 'Icons',
    description: 'CrabPal symbol icon',
    component: CrabPalSymbol,
    props: [
      {
        name: 'className',
        description: 'Tailwind classes for sizing',
        control: { type: 'string' },
        defaultValue: 'h-6 w-6',
      },
    ],
    variants: [
      { name: 'Small', props: { className: 'h-4 w-4' } },
      { name: 'Medium', props: { className: 'h-6 w-6' } },
      { name: 'Large', props: { className: 'h-10 w-10' } },
    ],
  },
  {
    id: 'panel-left-rounded',
    name: 'PanelLeftRounded',
    category: 'Icons',
    description: 'Sidebar toggle icon with rounded corners',
    component: PanelLeftRounded,
    props: [
      {
        name: 'className',
        description: 'Tailwind classes',
        control: { type: 'string' },
        defaultValue: 'h-5 w-5',
      },
    ],
    variants: [
      { name: 'Default', props: { className: 'h-5 w-5' } },
      { name: 'Large', props: { className: 'h-8 w-8' } },
      { name: 'Muted', props: { className: 'h-5 w-5 text-muted-foreground' } },
    ],
  },
  {
    id: 'square-pen-rounded',
    name: 'SquarePenRounded',
    category: 'Icons',
    description: 'New chat/compose icon with rounded corners',
    component: SquarePenRounded,
    props: [
      {
        name: 'className',
        description: 'Tailwind classes',
        control: { type: 'string' },
        defaultValue: 'h-5 w-5',
      },
    ],
    variants: [
      { name: 'Default', props: { className: 'h-5 w-5' } },
      { name: 'Large', props: { className: 'h-8 w-8' } },
      { name: 'Primary', props: { className: 'h-5 w-5 text-foreground' } },
    ],
  },
]
