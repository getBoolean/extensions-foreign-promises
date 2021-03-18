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
  import { generateSearch, isLastPage, parseChapterPageDetails, parseChapters, parseHomeSections, parseMangaDetails, parseSearch, parseTags, parseUpdatedManga, parseViewMore, UpdatedManga } from "./BainianMangaParser"
  
  const BM_DOMAIN = 'https://m.bnmanhua.com';
  const method = 'GET';
  const headers = {
    // "content-type": "application/x-www-form-urlencoded"
  };
  
  export const BainianMangaInfo: SourceInfo = {
    version: '0.0.1',
    name: 'BainianManga (百年漫画)',
    icon: 'favicon.ico',
    author: 'getBoolean',
    authorWebsite: 'https://github.com/getBoolean',
    description: 'Extension that pulls manga from BainianManga, includes Advanced Search',
    hentaiSource: false,
    websiteBaseURL: `${BM_DOMAIN}/comic.html`,
    sourceTags: [
      {
        text: "WIP",
        type: TagType.RED
      }
    ]
  }
  
  export class BainianManga extends Source {
    getMangaShareUrl(mangaId: string): string | null { return `${BM_DOMAIN}/comic/${mangaId}` }
  
    async getMangaDetails(mangaId: string): Promise<Manga> {
      const request = createRequestObject({
        url: `${BM_DOMAIN}/comic/`,
        method,
        param: `${mangaId}.html`
      })
  
      const response = await this.requestManager.schedule(request, 1)
      const $ = this.cheerio.load(response.data)
      return parseMangaDetails($, mangaId)
    }
  

    async getChapters(mangaId: string): Promise<Chapter[]> {
      const request = createRequestObject({
        url: `${BM_DOMAIN}/comic/`,
        method,
        param: `${mangaId}.html`
      })
  
      const response = await this.requestManager.schedule(request, 1)
      const $ = this.cheerio.load(response.data)
      return parseChapters($, mangaId)
    }
  

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        let request = createRequestObject({
            url: `${BM_DOMAIN}/comic/`,
            method,
            headers,
            param: `${mangaId}/${chapterId}.html`
        })

        // Get max number of pages
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)

        const numPages = Number($('span[id=k_total]', '.bo_tit').text())
        let page = 0

        // Create request objects for every page
        let chapterRequests = []
        for (let i = 1; i <= numPages; i++){
            chapterRequests.push(createRequestObject({
                url: `${BM_DOMAIN}/comic/`,
                method,
                headers,
                param: `${mangaId}/${chapterId}.html?p=${page}`
            }))
        }

        let chapterResponses = []
        for (const chapterRequestsItem of chapterRequests){
            chapterResponses.push(await this.requestManager.schedule(chapterRequestsItem, 1))
        }

        let chapterCheerios = []
        for (const chapterResponsesItem of chapterResponses){
            chapterCheerios.push(this.cheerio.load(chapterResponsesItem.data))
        }

        // Get image from every page
        let pages = []
        for (const chapterCheeriosItem of chapterCheerios){
            pages.push(parseChapterPageDetails(chapterCheeriosItem))
        }
        

        return createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages,
            longStrip: false
        })
    }
  

    async filterUpdatedManga(mangaUpdatesFoundCallback: (updates: MangaUpdates) => void, time: Date, ids: string[]): Promise<void> {
      let page = 1
      let updatedManga: UpdatedManga = {
        ids: [],
        loadMore: true
      }
  
      while (updatedManga.loadMore) {
        const request = createRequestObject({
          url: `${BM_DOMAIN}/page/all/`,
          method,
          headers,
          param: `${String(page++)}.html`
        })
  
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        updatedManga = parseUpdatedManga($, time, ids)
  
        if (updatedManga.ids.length > 0) {
          mangaUpdatesFoundCallback(createMangaUpdates({
            ids: updatedManga.ids
          }))
        }
      }
    }
  
    // TODO
    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
      // Give Paperback a skeleton of what these home sections should look like to pre-render them
      const section1 = createHomeSection({ id: 'a_recommended', title: '推荐漫画' })
      const section3 = createHomeSection({ id: 'hot_comics', title: '热门漫画', view_more: true })
      const section2 = createHomeSection({ id: 'z_new_updates', title: '最近更新', view_more: true })
      const sections = [section1, section2, section3]
  
      // Fill the homsections with data
      const request = createRequestObject({
        url: `${BM_DOMAIN}/comic.html`,
        method,
      })
  
      const response = await this.requestManager.schedule(request, 1)
      const $ = this.cheerio.load(response.data)
      parseHomeSections($, sections, sectionCallback)
    }
  

    async searchRequest(query: SearchRequest, metadata: any): Promise<PagedResults> {
      let page : number = metadata?.page ?? 1
      const search = generateSearch(query)
      const request = createRequestObject({
        url: `${BM_DOMAIN}/search/`,
        method,
        headers,
        param: `${search}/${page}.html`
      })
  
      const response = await this.requestManager.schedule(request, 1)
      const $ = this.cheerio.load(response.data)
      const manga = parseSearch($)
      metadata = !isLastPage($) ? {page: page + 1} : undefined
      
      return createPagedResults({
        results: manga,
        metadata
      })
    }
  

    async getTags(): Promise<TagSection[] | null> {
      const request = createRequestObject({
        url: `${BM_DOMAIN}/page/list.html`,
        method,
        headers,
      })
  
      const response = await this.requestManager.schedule(request, 1)
      const $ = this.cheerio.load(response.data)
      return parseTags($)
    }
  

    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults | null> {
      let page : number = metadata?.page ?? 1
      let param = ''
      if (homepageSectionId === 'hot_comics')
        param = `/page/hot/${page}.html`
      else if (homepageSectionId === 'z_new_updates')
        param = `/page/new/${page}.html`
      else return Promise.resolve(null)
  
      const request = createRequestObject({
        url: `${BM_DOMAIN}`,
        method,
        param,
      })
  
      const response = await this.requestManager.schedule(request, 1)
      const $ = this.cheerio.load(response.data)
      const manga = parseViewMore($)
      metadata = !isLastPage($) ? { page: page + 1 } : undefined
  
      return createPagedResults({
        results: manga,
        metadata
      })
    }
  

    globalRequestHeaders(): RequestHeaders {
      return {
        referer: BM_DOMAIN
      }
    }
  }