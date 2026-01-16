export default async function TripDetailPage({
  params,
}: Readonly<{
  params: Promise<{ tripId: string }>;
}>) {
  const { tripId } = await params;
  return <div>Trip Detail Page for Trip ID: {tripId}</div>;
}
