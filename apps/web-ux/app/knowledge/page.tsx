import { redirect } from 'next/navigation';

// /documents is the canonical user-facing documents route (full upload/index/classify
// lifecycle, matching the backend /documents resource and the mobile Documents screen).
// /knowledge is a legacy duplicate; redirect to the canonical route to avoid divergence.
export default function Knowledge() {
  redirect('/documents');
}
