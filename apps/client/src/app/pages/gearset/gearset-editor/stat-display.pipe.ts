import { Pipe, PipeTransform } from '@angular/core';
import { TeamcraftGearset } from '../../../model/gearset/teamcraft-gearset';
import { StatsService } from '../../../modules/gearsets/stats.service';

@Pipe({
  name: 'statDisplay'
})
export class StatDisplayPipe implements PipeTransform {

  constructor(private statsService: StatsService) {
  }

  transform(value: TeamcraftGearset, level: number, tribe: number, food: any, baseParamId: number): { name: string, value: number, suffix?: string }[] {
    return this.statsService.getStatsDisplay(value, level, tribe, food).filter(row => row.baseParamIds.includes(baseParamId));
  }

}
