const DATA_BASE = "data";

class DataFetchError extends Error {
  constructor(kind, url, detail, cause) {
    super(`${kind}: ${url} (${detail})`, { cause });
    this.name = "DataFetchError";
    this.kind = kind;
    this.url = url;
  }
}

async function fetchJson(url) {
  let response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw new DataFetchError("network", url, error.message, error);
  }
  if (!response.ok) {
    throw new DataFetchError(
      "http",
      url,
      `${response.status} ${response.statusText}`,
    );
  }
  try {
    return await response.json();
  } catch (error) {
    throw new DataFetchError("json", url, error.message, error);
  }
}

async function fetchCups() {
  return fetchJson(`${DATA_BASE}/cups.json`);
}

async function fetchCup(slug) {
  const cups = await fetchCups();
  const cup = cups.find((item) => item.slug === slug);
  if (!cup) throw new Error(`非法 cup：${slug}`);
  return cup;
}

async function fetchSeasonIds(cupSlug = DEFAULT_CUP) {
  await fetchCup(cupSlug);
  return fetchJson(`${DATA_BASE}/${cupSlug}/seasons.json`);
}

async function fetchSeason(id, cupSlug = DEFAULT_CUP) {
  if (!id) throw new Error("缺少 id 參數");
  const ids = await fetchSeasonIds(cupSlug);
  if (!ids.includes(id)) throw new Error(`非法 id：${id}`);
  return fetchJson(`${DATA_BASE}/${cupSlug}/${id}.json`);
}

async function fetchAllSeasons(cupSlug = DEFAULT_CUP) {
  const ids = await fetchSeasonIds(cupSlug);
  return Promise.all(
    ids.map((id) => fetchJson(`${DATA_BASE}/${cupSlug}/${id}.json`)),
  );
}
