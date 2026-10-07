interface FetchAPIEndPoint<
  Result extends {},
  Params extends { [param: string]: any } = {},
  Body extends { [key: string]: any } = {}
> {
  result: Result,
  params: Params,
  body: Body
};

type SpotifyMarket = "CA" | "BR" | "IT";
type SpotifyAPISearchType = "album" | "artist" | "playlist" | "track" | "show" | "episode" | "audiobook";
interface SpotifyAPISearchTypesMap {
  tracks: {
    href: string;
    limit: number;
    next: string | null;
    offset: number;
    previous: string | null;
    total: number;
    items: {
      album: {
        album_type: "compilation";
        total_tracks: number;
        available_markets: SpotifyMarket[];
        external_urls: { [K in "spotify"]?: string };
        href: string;
        id: string;
        images: {
          url: string;
          height: number;
          width: number
        }[];
        name: string;
        release_date: string;
        release_date_precision: "day";
        type: "album";
        url: string;
        artists: {
          external_urls: { [K in "spotify"]?: string };
          href: string;
          id: string;
          name: string;
          type: string;
          uri: string;
        }[]
      },
      available_markets: SpotifyMarket[];
      disc_number: 1;
      duration_ms: number;
      explicit: boolean;
      external_ids: { [K in "isrc"]?: string };
      external_urls: { [K in "spotify"]?: string };
      href: string;
      id: string;
      name: string;
      popularity: number;
      preview_url: string;
      track_number: number;
      type: "track";
      uri: string;
      is_local: boolean;
    }[];
  };
  artists: {
    href: string;
    items: {
        external_urls: {
            spotify: string;
        };
        followers: {
            href: string | null;
            total: number;
        };
        genres: string[];
        href: string;
        id: string;
        images: {
            height: number;
            url: string;
            width: number;
        }[];
        name: string;
        popularity: number;
        type: "artist";
        uri: string;
    }[]
  }
};

interface EndPointsMap {
  [endpoint: string]: FetchAPIEndPoint<{}>[]
};

interface SpotifyAPIEndPointsMap {

  "/search": [
    FetchAPIEndPoint<{ tracks: SpotifyAPISearchTypesMap["tracks"] }, {
      type: Extract<SpotifyAPISearchType, "track">;
      q: `artist:${string}` | `year:${number}` | `track:${string}` | `genre:${string}` | `album:${string}` | `isrc:${string}`;
    }>,
    FetchAPIEndPoint<{ artists: SpotifyAPISearchTypesMap["artists"] }, {
      type: Extract<SpotifyAPISearchType, "artist">,
      q: `artist:${string}` | `year:${string}` | `genre:${string}`
    }>
  ];

}

type ResultUsingParam<T extends EndPointsMap, K extends keyof T, P extends T[K][number]> = { [I in Exclude<keyof T[K], keyof []> as T[K][I] extends FetchAPIEndPoint<infer R, infer Params> ? P extends Params ? I : never : never]: T[K][I] };