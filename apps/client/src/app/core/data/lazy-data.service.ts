import { isPlatformServer } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { Craft } from '@ffxiv-teamcraft/simulator';
import { TranslateService } from '@ngx-translate/core';
import { XivapiService } from '@xivapi/angular-client';
import { BehaviorSubject, combineLatest, Observable, ReplaySubject, Subject } from 'rxjs';
import { filter, first, map, startWith } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { extractsHash } from '../../../environments/extracts-hash';
import { I18nName } from '../../model/common/i18n-name';
import { ListRow } from '../../modules/list/model/list-row';
import { Region } from '../../modules/settings/region.enum';
import { SettingsService } from '../../modules/settings/settings.service';
import { PlatformService } from '../tools/platform.service';
import { Language } from './language';
import { LazyData } from './lazy-data';
import { LazyDataProviderService } from './lazy-data-provider.service';
import { lazyFilesList } from './lazy-files-list';
import { XivapiPatch } from './model/xivapi-patch';

@Injectable({
  providedIn: 'root'
})
export class LazyDataService {
  public dohdolMeldingRates = {
    hq: [
      // Sockets
      //2, 3,  4,  5    // Tier
      [90, 48, 28, 16], // I
      [82, 44, 26, 16], // II
      [70, 38, 22, 14], // III
      [58, 32, 20, 12], // IV
      [17, 10, 7, 5], // V
      [17, 0, 0, 0], // VI
      [17, 10, 7, 5], // VII
      [17, 0, 0, 0] // VIII
    ],
    nq: [
      // Sockets
      //2, 3,  4,  5    // Tier
      [80, 40, 20, 10], // I
      [72, 36, 18, 10], // II
      [60, 30, 16, 8], // III
      [48, 24, 12, 6], // IV
      [12, 6, 3, 2], // V
      [12, 0, 0, 0], // VI
      [12, 6, 3, 2], // VII
      [12, 0, 0, 0] // VIII
    ]
  };

  // List of GatheringPointBase ids that cannot spawn anymore due to various conditions
  public ignoredNodes = [653, 654, 655, 656, 657, 658, 659, 660, 661, 662, 663, 664, 665, 666, 667, 668, 669, 670, 671, 672, 673, 674, 675, 676, 677, 678, 679, 680];

  public loaded$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

  public datacenters: Record<string, string[]> = {};
  public patches: XivapiPatch[] = [];

  protected extracts: Record<number, ListRow> = {};
  public extracts$: ReplaySubject<ListRow[]> = new ReplaySubject<ListRow[]>();

  public data: LazyData;
  public data$: ReplaySubject<LazyData> = new ReplaySubject<LazyData>();

  public readonly diademTerritory$: Observable<unknown> = this.lazyDataProvider.getLazyData('diademTerritory');
  public readonly fishes$: Observable<number[]> = this.lazyDataProvider.getLazyData('fishes');
  public readonly fishingSpots$ = this.lazyDataProvider.getLazyData('fishingSpots');
  public readonly itemIcons$: Observable<Record<string, string>> = this.lazyDataProvider.getLazyData('itemIcons');

  private loadedLangs: Language[] = [];

  constructor(
    private http: HttpClient,
    private xivapi: XivapiService,
    @Inject(PLATFORM_ID) private platform: Object,
    private platformService: PlatformService,
    private settings: SettingsService,
    private readonly lazyDataProvider: LazyDataProviderService,
    readonly translate: TranslateService
  ) {
    if (isPlatformServer(platform)) {
      this.loaded$.next(true);
    } else {
      this.load(translate.currentLang as Language);
      if (translate.onLangChange) {
        translate.onLangChange.subscribe((change) => {
          this.load(change.lang as Language);
        });
      }

      this.settings.regionChange$.subscribe((change) => {
        this.loadForRegion(change.next);
      });

      this.loadForRegion(this.settings.region);
    }
  }

  public getDataCenter(serverName: string): string {
    const fromData = Object.keys(this.datacenters)
      .find(dc => {
        return this.datacenters[dc].includes(serverName);
      });
    if (!fromData && serverName.toLowerCase().includes('korean')) {
      return 'Korea';
    }
    return fromData;
  }

  private loadForRegion(region: Region): void {
    switch (region) {
      case Region.Global:
        this.load('en');
        break;
      case Region.Korea:
        this.load('ko');
        break;
      case Region.China:
        this.load('zh');
        break;
    }
  }

  public getMapIdByZoneId(zoneId: number): number {
    return +Object.keys(this.data.maps).find((key) => this.data.maps[key].placename_id === zoneId);
  }

  public getJobAbbrs(): Record<number, I18nName> {
    return Object.keys(this.data.jobAbbr).reduce((acc, key) => {
      return {
        ...acc,
        [key]: {
          ...this.data.jobAbbr[key],
          ko: this.data.koJobAbbr[key]?.ko || this.data.jobAbbr[key].en,
          zh: this.data.zhJobAbbr[key]?.zh || this.data.jobAbbr[key].en
        }
      };
    }, {});
  }

  public getJobIdByAbbr(abbr: string): number {
    const abbrs = this.getJobAbbrs();
    return +(
      Object.keys(abbrs).find((key) => {
        return abbrs[key].en.toLowerCase() === abbr.toLowerCase();
      }) || -1
    );
  }

  public getItemLeveIds(itemId: number): number[] {
    return Object.entries<any>(this.data.leves)
      .filter(([, leve]) => {
        return leve.items.some(i => i.itemId === itemId);
      })
      .map(([id]) => +id);
  }

  public getRecipe(id: string): Observable<Craft> {
    return combineLatest([this.settings.regionChange$.pipe(startWith({ next: this.settings.region, previous: null })), this.data$]).pipe(
      map(([change, data]) => {
        switch (change.next) {
          case Region.China:
            return data.zhRecipes;
          case Region.Korea:
            return data.koRecipes;
          default:
            return data.recipes;
        }
      }),
      filter((recipes) => recipes !== undefined),
      map((recipes) => {
        return recipes.find((r) => r.id.toString() === id.toString()) || this.data.recipes.find((r) => r.id.toString() === id.toString());
      }),
      map(recipe => {
        if (!recipe.conditionsFlag) {
          recipe.conditionsFlag = 15;
        }
        return recipe;
      })
    );
  }

  public getRecipeSync(id: string): Craft {
    return this.getRecipes().find((r) => r.id.toString() === id.toString()) || this.data.recipes.find((r) => r.id.toString() === id.toString());
  }

  public getItemRecipeSync(id: string): Craft {
    return this.getRecipes().find((r) => (r as any).result.toString() === id.toString());
  }

  public getRecipes(): Craft[] {
    switch (this.settings.region) {
      case Region.China:
        return this.data.zhRecipes;
      case Region.Korea:
        return this.data.koRecipes;
      default:
        return this.data.recipes;
    }
  }

  public getExtract(id: number): ListRow {
    return this.extracts[id];
  }

  public get allItems(): any {
    const res = { ...this.data.items };
    if (this.data.koItems) {
      Object.keys(this.data.koItems).forEach((koKey) => {
        if (res[koKey] !== undefined) {
          res[koKey].ko = this.data.koItems[koKey].ko;
        } else {
          res[koKey] = this.data.koItems[koKey];
        }
      });
    }
    if (this.data.zhItems) {
      Object.keys(this.data.zhItems).forEach((zhKey) => {
        if (res[zhKey] !== undefined) {
          res[zhKey].zh = this.data.zhItems[zhKey].zh;
        } else {
          res[zhKey] = this.data.zhItems[zhKey];
        }
      });
    }
    return res;
  }

  public merge(...dataEntries: any[]): any {
    return dataEntries.reduce((merged, entry) => {
      Object.keys(entry).forEach((key) => {
        if (merged[key] !== undefined) {
          Object.keys(entry[key]).forEach((lang) => {
            merged[key][lang] = entry[key][lang];
          });
        } else {
          merged[key] = merged[key] || entry[key];
        }
      });
      return merged;
    }, {});
  }

  public load(lang: Language): void {
    const xivapiAndExtractsReady$ = new Subject();
    const lazyFilesReady$ = new Subject();

    combineLatest([xivapiAndExtractsReady$, lazyFilesReady$])
      .pipe(first())
      .subscribe(() => {
        this.loaded$.next(true);
      });

    const extractsPath = `/assets/extracts/extracts${environment.production ? '.' + extractsHash : ''}.json`;

    combineLatest([this.xivapi.getDCList(), this.getData<XivapiPatch[]>('https://xivapi.com/patchlist'), this.getData(extractsPath)]).subscribe(
      ([dcList, patches, extracts]) => {
        this.datacenters = dcList as { [index: string]: string[] };
        this.patches = patches;
        this.extracts = extracts;
        this.extracts$.next(extracts);
        xivapiAndExtractsReady$.next();
        xivapiAndExtractsReady$.complete();
      }
    );

    const languageToLoad = ['ko', 'zh'].indexOf(lang) > -1 ? lang : 'en';

    if (this.loadedLangs.indexOf(languageToLoad) > -1) {
      return;
    }

    this.loadedLangs.push(languageToLoad);

    const mandatoryForeignFiles = ['job-abbr.json'];

    const filesToLoad = Object.entries(lazyFilesList).filter(([key, entry]) => {
      if (mandatoryForeignFiles.some((file) => entry.fileName.toLowerCase().endsWith(file))) {
        return true;
      }
      if (languageToLoad === 'en') {
        return entry.fileName.split('/').length === 1 || entry.fileName.indexOf('items') > -1;
      } else {
        return entry.fileName.startsWith(`/${languageToLoad}`) || entry.fileName.split('/').length === 1;
      }
    });

    combineLatest(
      filesToLoad.map(([key, row]) => {
        return this.getData(`/assets/data/${environment.production ? row.hashedFileName : row.fileName}`).pipe(
          map((data) => {
            return {
              ...row,
              propertyName: key,
              data: data
            };
          })
        );
      })
    ).subscribe((results) => {
      const lazyData: Partial<LazyData> = this.data || {};
      results.forEach((row) => {
        lazyData[row.propertyName] = row.data;
      });
      this.data = lazyData as LazyData;
      this.data$.next(this.data);
      lazyFilesReady$.next();
      this.loadedLangs.push(languageToLoad);
    });
  }

  private getData<T = any>(path: string): Observable<T> {
    let url: string;
    if (path.startsWith('http')) {
      url = path;
    } else {
      if (this.platformService.isDesktop() || !environment.production || isPlatformServer(this.platform)) {
        url = `.${path}`;
      } else {
        url = `https://cdn.ffxivteamcraft.com${path}`;
      }
    }
    return this.http.get<T>(url);
  }
}
