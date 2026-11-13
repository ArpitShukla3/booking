import { Link } from 'react-router-dom';
import { ErrorState, LoadingState, PageContainer } from '@/components/shared/common';
import { apiClient } from '@/lib/api';
import { useAsync } from '@/lib/useAsync';
import { hotelCreditsUrl } from '@/services/groupHotelService';
import { parseCredits } from './credits';

export default function CreditsPage() {
  const credits = useAsync(async () => parseCredits((await apiClient.get<string>(hotelCreditsUrl(), { responseType: 'text' })).data), 'credits');
  return (
    <PageContainer className="gp-page">
      <h1>Photo credits</h1>
      <p className="text-muted-foreground mt-2">
        Hotel photos come from Wikimedia Commons (public domain or Creative Commons). The hotels are fictional, so several share a generic room photo.
        City photos are listed in <a className="text-link" href="/images/CREDITS.md" target="_blank" rel="noreferrer">the city credits</a>.
        Maps © <a className="text-link" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>.
      </p>
      <div className="card mt-4 hd-table-wrap">
        {credits.loading ? <LoadingState /> : credits.error ? <ErrorState error={credits.error} retry={credits.retry} /> : (
          <table className="hd-rooms hd-credits">
            <thead><tr><th scope="col">Photo</th><th scope="col">Used for</th><th scope="col">Source</th><th scope="col">Author</th><th scope="col">License</th></tr></thead>
            <tbody>
              {credits.data?.map((c) => (
                <tr key={c.file}>
                  <th scope="row"><code>{c.file.replace('images/hotels/', '')}</code></th>
                  <td>{c.usedFor}</td>
                  <td>{c.source.href ? <a className="text-link" href={c.source.href} target="_blank" rel="noreferrer">{c.source.text}</a> : c.source.text}</td>
                  <td>{c.author}</td>
                  <td>{c.license.href ? <a className="text-link" href={c.license.href} target="_blank" rel="noreferrer">{c.license.text}</a> : c.license.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="mt-4"><Link className="text-link" to="/my-groups">Back to my groups</Link></p>
    </PageContainer>
  );
}
