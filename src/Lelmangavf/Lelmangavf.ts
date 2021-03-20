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
import {LelmangavfParser,} from './LelmangavfParser'

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
      const data = await this.requestManager.schedule(request, 1)

      let $ = this.cheerio.load(data.data)

      return this.parser.parseMangaDetails($, mangaId)
  }


  async getChapters(mangaId: string): Promise<Chapter[]> {
      let chapters: Chapter[] = []
      let pageRequest = createRequestObject({
          url: `${LM_DOMAIN}/scan-manga/${mangaId}`,
          method
      })
      const pageData = await this.requestManager.schedule(pageRequest, 1)
      let $ = this.cheerio.load(pageData.data)
      chapters = chapters.concat(this.parser.parseChapterList($, mangaId, this))

      return chapters
  }


  async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {

      let request = createRequestObject({
          url: `${BATOTO_DOMAIN}/chapter/${chapterId}`,
          method,
      })

      let data = await this.requestManager.schedule(request, 1)

      let $ = this.cheerio.load(data.data, {xmlMode: false})
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
              url: `${BATOTO_DOMAIN}/browse/?sort=update&page=${String(currPageNum)}`,
              method
          })

          let data = await this.requestManager.schedule(request, 1)
          let $ = this.cheerio.load(data.data)

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

  async searchRequest(query: SearchRequest, metadata: any): Promise<PagedResults> {
      let page: number = metadata?.page ?? 1

      let request = createRequestObject({
          url: `${BATOTO_DOMAIN}/search`,
          method,
          param: `?word=${encodeURIComponent(query.title ?? '')}&page=${page}`
      })

      let data = await this.requestManager.schedule(request, 1)
      let $ = this.cheerio.load(data.data)
      let manga = this.parser.parseSearchResults($, this)
      let mData = undefined
      if (!this.parser.isLastPage($)) {
          mData = {page: (page + 1)}
      }

      return createPagedResults({
          results: manga,
          metadata: mData
      })

  }


  async getTags(): Promise<TagSection[] | null> {
      const request = createRequestObject({
          url: `${BATOTO_DOMAIN}/browse`,
          method
      })

      const data = await this.requestManager.schedule(request, 1)
      let $ = this.cheerio.load(data.data)

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
          mData = {page: (page + 1)}
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
      let trimmed: number = Number((/\d*/.exec(timeAgo) ?? [])[0])
      trimmed = (trimmed == 0 && timeAgo.includes('a')) ? 1 : trimmed
      if (timeAgo.includes('sec') || timeAgo.includes('secs')) {
          time = new Date(Date.now() - trimmed * 1000)
      } else if (timeAgo.includes('min') || timeAgo.includes('mins')) {
          time = new Date(Date.now() - trimmed * 60000)
      } else if (timeAgo.includes('hour') || timeAgo.includes('hours')) {
          time = new Date(Date.now() - trimmed * 3600000)
      } else if (timeAgo.includes('day') || timeAgo.includes('days')) {
          time = new Date(Date.now() - trimmed * 86400000)
      } else if (timeAgo.includes('year') || timeAgo.includes('years')) {
          time = new Date(Date.now() - trimmed * 31556952000)
      } else {
          time = new Date(Date.now())
      }

      return time
  }

}