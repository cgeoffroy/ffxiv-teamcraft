import { ListsAction, ListsActionTypes } from './lists.actions';
import { List } from '../model/list';


const PINNED_LIST_LS_KEY = 'lists:pinned';

export interface ListsState {
  listDetails: List[];
  selectedId?: string; // which Lists record has been selected
  autocompletionEnabled?: boolean;
  completionNotificationEnabled?: boolean;
  listsConnected: boolean;
  needsVerification: boolean;
  connectedTeams: string[];
  deleted: string[];
  pinned: string;
  showArchived: boolean;
}

export const initialState: ListsState = {
  listDetails: [],
  listsConnected: false,
  needsVerification: false,
  deleted: [],
  connectedTeams: [],
  pinned: localStorage.getItem(PINNED_LIST_LS_KEY) || 'none',
  showArchived: false
};

export function listsReducer(
  state: ListsState = initialState,
  action: ListsAction
): ListsState {
  switch (action.type) {

    case ListsActionTypes.NeedsVerification: {
      state = {
        ...state,
        needsVerification: action.verificationNeeded
      };
      break;
    }

    case ListsActionTypes.ToggleAutocompletion: {
      state = {
        ...state,
        autocompletionEnabled: action.enabled
      };
      break;
    }

    case ListsActionTypes.ToggleCompletionNotification: {
      state = {
        ...state,
        completionNotificationEnabled: action.enabled
      };
      break;
    }

    case ListsActionTypes.MyListsLoaded: {
      state = {
        ...state,
        listDetails: [
          ...state.listDetails.filter(list => list.authorId !== action.userId || list.offline || list.archived),
          ...action.payload
        ],
        listsConnected: true
      };
      break;
    }

    case ListsActionTypes.LoadArchivedLists: {
      state = {
        ...state,
        showArchived: true
      };
      break;
    }

    case ListsActionTypes.UnLoadArchivedLists: {
      state = {
        ...state,
        showArchived: false
      };
      break;
    }

    case ListsActionTypes.ArchivedListsLoaded: {
      state = {
        ...state,
        listDetails: [
          ...state.listDetails.filter(list => list.authorId !== action.userId || !list.archived),
          ...action.payload
        ]
      };
      break;
    }

    case ListsActionTypes.OfflineListsLoaded: {
      state = {
        ...state,
        listDetails: [
          ...state.listDetails.filter(list => !list.offline),
          ...action.payload
        ]
      };
      break;
    }

    case ListsActionTypes.LoadTeamLists: {
      state = {
        ...state
      };
      break;
    }

    case ListsActionTypes.TeamListsLoaded: {
      state = {
        ...state,
        listDetails: [
          ...state.listDetails.filter(list => list.teamId !== action.teamId),
          ...action.payload
        ],
        connectedTeams: [
          ...state.connectedTeams,
          action.teamId
        ]
      };
      break;
    }

    case ListsActionTypes.SharedListsLoaded: {
      state = {
        ...state,
        listDetails: [
          ...state.listDetails.filter(list => action.payload.find(c => c.$key === list.$key) === undefined),
          ...action.payload
        ]
      };
      break;
    }

    case ListsActionTypes.ListsForTeamsLoaded: {
      state = {
        ...state,
        listDetails: [
          ...state.listDetails.filter(list => action.payload.find(c => c.$key === list.$key) === undefined),
          ...action.payload
        ]
      };
      break;
    }

    case ListsActionTypes.UpdateList:
    case ListsActionTypes.UpdateListAtomic: {
      state = {
        ...state,
        listDetails: [
          ...state.listDetails.map(list => list.$key === action.payload.$key ? action.payload.clone(true) : list)
        ]
      };
      break;
    }

    case ListsActionTypes.ListDetailsLoaded: {
      state = {
        ...state,
        listDetails: [
          ...state.listDetails.filter(list => list.$key !== action.payload.$key),
          <List>action.payload
        ]
      };
      break;
    }

    case ListsActionTypes.DeleteList: {
      state = {
        ...state,
        listDetails: [
          ...state.listDetails.filter(list => list.$key !== action.key)
        ],
        deleted: [...state.deleted, action.key]
      };
      break;
    }

    case ListsActionTypes.SelectList: {
      state = {
        ...state,
        selectedId: action.key
      };
      break;
    }

    case ListsActionTypes.PinList: {
      state = {
        ...state,
        pinned: action.uid
      };
      localStorage.setItem(PINNED_LIST_LS_KEY, action.uid);
      break;
    }

    case ListsActionTypes.UnPinList: {
      state = {
        ...state,
        pinned: 'none'
      };
      localStorage.setItem(PINNED_LIST_LS_KEY, 'none');
      break;
    }
  }
  return state;
}
