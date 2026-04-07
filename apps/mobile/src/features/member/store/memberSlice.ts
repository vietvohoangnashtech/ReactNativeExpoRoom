import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as DataSync from '@xpw2/datasync';
import type { MemberRecord } from '@xpw2/datasync';

interface MemberState {
  members: MemberRecord[];
  selectedMember: MemberRecord | null;
  searchResults: MemberRecord[];
  isLoading: boolean;
  error: string | null;
}

const initialState: MemberState = {
  members: [],
  selectedMember: null,
  searchResults: [],
  isLoading: false,
  error: null,
};

export const loadMembersThunk = createAsyncThunk('member/loadAll', async () => {
  return DataSync.getAllMembers();
});

export const searchMembersThunk = createAsyncThunk(
  'member/search',
  async (query: string) => {
    return DataSync.searchMembers(query);
  }
);

export const identifyMemberByNfcThunk = createAsyncThunk(
  'member/identifyByNfc',
  async ({ nfcCardId, sessionId }: { nfcCardId: string; sessionId: string }) => {
    const member = await DataSync.getMemberByNfc(nfcCardId);
    if (member) {
      await DataSync.recordEvent(
        'MemberIdentified',
        { memberId: member.id, method: 'nfc', nfcCardId },
        sessionId
      );
    }
    return member;
  }
);

export const selectMemberThunk = createAsyncThunk(
  'member/select',
  async ({ memberId, sessionId }: { memberId: string; sessionId: string }) => {
    const member = await DataSync.getMember(memberId);
    if (member) {
      await DataSync.recordEvent(
        'MemberIdentified',
        { memberId: member.id, method: 'search' },
        sessionId
      );
    }
    return member;
  }
);

const memberSlice = createSlice({
  name: 'member',
  initialState,
  reducers: {
    clearSelectedMember(state) {
      state.selectedMember = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadMembersThunk.fulfilled, (state, action) => {
        state.members = action.payload;
      })
      .addCase(searchMembersThunk.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(searchMembersThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.searchResults = action.payload;
      })
      .addCase(identifyMemberByNfcThunk.fulfilled, (state, action) => {
        state.selectedMember = action.payload;
      })
      .addCase(selectMemberThunk.fulfilled, (state, action) => {
        state.selectedMember = action.payload;
      });
  },
});

export const { clearSelectedMember } = memberSlice.actions;
export default memberSlice.reducer;
