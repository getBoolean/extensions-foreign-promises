import {
    Source,
    Manga,
    Chapter,
    ChapterDetails,
    HomeSection,
    SearchRequest,
    TagSection,
    PagedResults,
    SourceInfo,
    MangaUpdates,
    RequestHeaders,
    TagType
} from "paperback-extensions-common"
import { LelmangavfParser, } from './LelmangavfParser'

const LM_DOMAIN = 'https://www.lelmangavf.com';
const method = 'GET';
const headers = {
    referer: LM_DOMAIN
};

export const LelmangavfInfo: SourceInfo = {
    version: '1.0.6',
    name: 'Lelmangavf',
    icon: 'default_favicon.png',
    author: 'getBoolean',
    authorWebsite: 'https://github.com/getBoolean',
    description: 'Extension that pulls manga from BainianManga',
    hentaiSource: false,
    websiteBaseURL: `${LM_DOMAIN}/comic.html`,
    sourceTags: [
        {
            text: "Notifications",
            type: TagType.GREEN
        },
        {
            text: "French",
            type: TagType.GREY
        }
    ]
}

export class Lelmangavf extends Source {
    parser = new LelmangavfParser()

    getMangaShareUrl(mangaId: string): string | null {
        return `${LM_DOMAIN}/scan-manga/${mangaId}`
    }

    async getMangaDetails(mangaId: string): Promise<Manga> {

        let request = createRequestObject({
            url: `${LM_DOMAIN}/scan-manga/${mangaId}`,
            method
        })
        const response = await this.requestManager.schedule(request, 1)

        let $ = this.cheerio.load(response.data)

        return this.parser.parseMangaDetails($, mangaId)
    }


    async getChapters(mangaId: string): Promise<Chapter[]> {
        let chapters: Chapter[] = []
        let pageRequest = createRequestObject({
            url: `${LM_DOMAIN}/scan-manga/${mangaId}`,
            method
        })
        const response = await this.requestManager.schedule(pageRequest, 1)
        let $ = this.cheerio.load(response.data)
        chapters = chapters.concat(this.parser.parseChapterList($, mangaId, this))

        return chapters
    }


    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {

        let request = createRequestObject({
            url: chapterId,
            method,
        })

        let response = await this.requestManager.schedule(request, 1)

        let $ = this.cheerio.load(response.data)
        let pages: string[] = this.parser.parseChapterDetails($)

        return createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages,
            longStrip: false
        })
    }

    async filterUpdatedManga(mangaUpdatesFoundCallback: (updates: MangaUpdates) => void, time: Date, ids: string[]): Promise<void> {

        let loadNextPage: boolean = true
        let currPageNum: number = 1

        while (loadNextPage) {

            let request = createRequestObject({
                url: `${LM_DOMAIN}/latest-release?page=${currPageNum}`,
                method
            })

            let response = await this.requestManager.schedule(request, 1)
            let $ = this.cheerio.load(response.data)

            let updatedManga = this.parser.filterUpdatedManga($, time, ids, this)
            loadNextPage = updatedManga.loadNextPage
            if (loadNextPage) {
                currPageNum++
            }
            if (updatedManga.updates.length > 0) {
                mangaUpdatesFoundCallback(createMangaUpdates({
                    ids: updatedManga.updates
                }))
            }
        }
    }

    async searchRequest(query: SearchRequest, _metadata: any): Promise<PagedResults> {
        let request = createRequestObject({
            url: `${LM_DOMAIN}/search`,
            method,
        })
        let response = await this.requestManager.schedule(request, 1)
        // let $ = this.cheerio.load(response.data)
        let manga = this.parser.parseSearchResults(response.data, this, query.title ?? '')

        return createPagedResults({
            results: manga,
        })

    }


    async getTags(): Promise<TagSection[] | null> {
        const request = createRequestObject({
            url: `${LM_DOMAIN}/scan-manga-list`,
            method
        })

        const response = await this.requestManager.schedule(request, 1)
        let $ = this.cheerio.load(response.data)

        return this.parser.parseTags($)
    }


    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {

        const sections = [
            {
                request: createRequestObject({
                    url: `${BATOTO_DOMAIN}/browse?sort=create`,
                    method
                }),
                section: createHomeSection({
                    id: '0',
                    title: 'RECENTLY ADDED',
                    view_more: true,
                }),
            },
            {
                request: createRequestObject({
                    url: `${BATOTO_DOMAIN}/browse?sort=update`,
                    method
                }),
                section: createHomeSection({
                    id: '1',
                    title: 'RECENTLY UPDATED',
                    view_more: true,
                }),
            },
            {
                request: createRequestObject({
                    url: `${BATOTO_DOMAIN}/browse?sort=views_a`,
                    method
                }),
                section: createHomeSection({
                    id: '2',
                    title: 'POPULAR',
                    view_more: true
                }),
            },
        ]

        const promises: Promise<void>[] = []

        for (const section of sections) {
            // Let the app load empty sections
            sectionCallback(section.section)

            // Get the section data
            promises.push(
                this.requestManager.schedule(section.request, 1).then(response => {
                    const $ = this.cheerio.load(response.data)
                    section.section.items = this.parser.parseHomePageSection($, this)
                    sectionCallback(section.section)
                }),
            )
        }

        // Make sure the function completes
        await Promise.all(promises)
    }


    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults | null> {
        let webPage = ''
        let page: number = metadata?.page ?? 1
        switch (homepageSectionId) {
            case '0': {
                webPage = `?sort=views_a&page=${page}`
                break
            }
            case '1': {
                webPage = `?sort=update&page=${page}`
                break
            }
            case '2': {
                webPage = `?sort=create&page=${page}`
                break
            }
            default:
                return Promise.resolve(null)
        }

        let request = createRequestObject({
            url: `${BATOTO_DOMAIN}/browse${webPage}`,
            method
        })

        let data = await this.requestManager.schedule(request, 1)
        let $ = this.cheerio.load(data.data)
        let manga = this.parser.parseHomePageSection($, this)
        let mData
        if (!this.parser.isLastPage($)) {
            mData = { page: (page + 1) }
        } else {
            mData = undefined  // There are no more pages to continue on to, do not provide page metadata
        }

        return createPagedResults({
            results: manga,
            metadata: mData
        })
    }

    cloudflareBypassRequest() {
        return createRequestObject({
            url: `${LM_DOMAIN}`,
            method,
        })
    }

    protected convertTime(timeAgo: string): Date {
        let time: Date
        if (timeAgo.includes('Hier')) { // Yesterday
            time = new Date()
            time.setDate(time.getDate() - 1);
        } else if (isNaN(Number(timeAgo))) { // Today
            time = new Date(Date.now())
        } else {
            time = new Date(timeAgo)
        }

        return time
    }

}