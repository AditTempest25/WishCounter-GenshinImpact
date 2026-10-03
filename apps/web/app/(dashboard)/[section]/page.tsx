import { notFound } from "next/navigation";
import { dashboardPages } from "../../../lib/dashboard-pages";

export function generateStaticParams() {
  return dashboardPages.filter(page => page.slug).map(page => ({ section: page.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const page = dashboardPages.find(page => page.slug === section);
  return { title: page ? `${page.label} · Irminsul Wish` : "Irminsul Wish" };
}

export default async function DashboardPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!dashboardPages.some(page => page.slug === section && page.slug)) notFound();
  return null;
}
